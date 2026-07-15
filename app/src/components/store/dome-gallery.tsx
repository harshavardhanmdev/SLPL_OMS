"use client";

/**
 * Rotating product dome for the home hero, adapted from the React Bits
 * DomeGallery (MIT). Changes for SLPL Store:
 *  - auto-rotates slowly; pauses while hovered or dragged
 *  - clicking a tile navigates to the product page (no enlarge overlay)
 *  - denser tile rows so the visible sphere face has no empty poles
 *  - colors follow the site theme via the --dome-overlay CSS variable
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useGesture } from "@use-gesture/react";

export type DomeImage = { src: string; alt: string; href: string };

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const wrapAngleSigned = (deg: number) => {
  const a = (((deg + 180) % 360) + 360) % 360;
  return a - 180;
};

type Item = { x: number; y: number; sizeX: number; sizeY: number } & DomeImage;

function buildItems(pool: DomeImage[], segments: number): Item[] {
  const xCols = Array.from({ length: segments }, (_, i) => -(segments - 1) + i * 2);
  // Two extra row-bands vs the original so the sphere face looks fully tiled
  const evenYs = [-8, -6, -4, -2, 0, 2, 4, 6, 8];
  const oddYs = [-7, -5, -3, -1, 1, 3, 5, 7, 9];

  const coords = xCols.flatMap((x, c) => {
    const ys = c % 2 === 0 ? evenYs : oddYs;
    return ys.map((y) => ({ x, y, sizeX: 2, sizeY: 2 }));
  });

  if (pool.length === 0) {
    return coords.map((c) => ({ ...c, src: "", alt: "", href: "" }));
  }

  const used = Array.from({ length: coords.length }, (_, i) => pool[i % pool.length]);
  // Avoid identical neighbours where possible
  for (let i = 1; i < used.length; i++) {
    if (used[i].src === used[i - 1].src) {
      for (let j = i + 1; j < used.length; j++) {
        if (used[j].src !== used[i].src) {
          [used[i], used[j]] = [used[j], used[i]];
          break;
        }
      }
    }
  }
  return coords.map((c, i) => ({ ...c, ...used[i] }));
}

export default function DomeGallery({
  images,
  fit = 0.6,
  minRadius = 460,
  maxRadius = 900,
  segments = 30,
  maxVerticalRotationDeg = 6,
  dragSensitivity = 22,
  dragDampening = 2,
  autoRotateDegPerSec = 1.6,
}: {
  images: DomeImage[];
  fit?: number;
  minRadius?: number;
  maxRadius?: number;
  segments?: number;
  maxVerticalRotationDeg?: number;
  dragSensitivity?: number;
  dragDampening?: number;
  autoRotateDegPerSec?: number;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const sphereRef = useRef<HTMLDivElement>(null);

  const rotationRef = useRef({ x: 0, y: 0 });
  const startRotRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const hoveredRef = useRef(false);
  const inertiaRAF = useRef<number | null>(null);
  const lastDragEndAt = useRef(0);

  const items = useMemo(() => buildItems(images, segments), [images, segments]);

  const applyTransform = (xDeg: number, yDeg: number) => {
    const el = sphereRef.current;
    if (el) {
      el.style.transform = `translateZ(calc(var(--radius) * -1)) rotateX(${xDeg}deg) rotateY(${yDeg}deg)`;
    }
  };

  // Size the dome to its container
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      const w = Math.max(1, cr.width);
      const h = Math.max(1, cr.height);
      const radius = clamp(Math.min(w, h) * fit, minRadius, maxRadius);
      root.style.setProperty("--radius", `${Math.round(radius)}px`);
      applyTransform(rotationRef.current.x, rotationRef.current.y);
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, [fit, minRadius, maxRadius]);

  // Slow auto-rotation; holds still while hovered, dragged or coasting
  useEffect(() => {
    let raf: number;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!hoveredRef.current && !draggingRef.current && inertiaRAF.current == null) {
        const next = wrapAngleSigned(rotationRef.current.y + autoRotateDegPerSec * dt);
        rotationRef.current = { ...rotationRef.current, y: next };
        applyTransform(rotationRef.current.x, next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoRotateDegPerSec]);

  const stopInertia = useCallback(() => {
    if (inertiaRAF.current != null) {
      cancelAnimationFrame(inertiaRAF.current);
      inertiaRAF.current = null;
    }
  }, []);

  const startInertia = useCallback(
    (vx: number, vy: number) => {
      const MAX_V = 1.4;
      let vX = clamp(vx, -MAX_V, MAX_V) * 80;
      let vY = clamp(vy, -MAX_V, MAX_V) * 80;
      let frames = 0;
      const d = clamp(dragDampening ?? 0.6, 0, 1);
      const frictionMul = 0.94 + 0.055 * d;
      const stopThreshold = 0.015 - 0.01 * d;
      const maxFrames = Math.round(90 + 270 * d);
      const step = () => {
        vX *= frictionMul;
        vY *= frictionMul;
        if ((Math.abs(vX) < stopThreshold && Math.abs(vY) < stopThreshold) || ++frames > maxFrames) {
          inertiaRAF.current = null;
          return;
        }
        const nextX = clamp(rotationRef.current.x - vY / 200, -maxVerticalRotationDeg, maxVerticalRotationDeg);
        const nextY = wrapAngleSigned(rotationRef.current.y + vX / 200);
        rotationRef.current = { x: nextX, y: nextY };
        applyTransform(nextX, nextY);
        inertiaRAF.current = requestAnimationFrame(step);
      };
      stopInertia();
      inertiaRAF.current = requestAnimationFrame(step);
    },
    [dragDampening, maxVerticalRotationDeg, stopInertia],
  );

  useGesture(
    {
      onDragStart: ({ event }) => {
        stopInertia();
        const evt = event as PointerEvent;
        draggingRef.current = true;
        movedRef.current = false;
        startRotRef.current = { ...rotationRef.current };
        startPosRef.current = { x: evt.clientX, y: evt.clientY };
      },
      onDrag: ({ event, last, velocity = [0, 0], direction = [0, 0] }) => {
        if (!draggingRef.current || !startPosRef.current) return;
        const evt = event as PointerEvent;
        const dxTotal = evt.clientX - startPosRef.current.x;
        const dyTotal = evt.clientY - startPosRef.current.y;
        if (!movedRef.current && dxTotal * dxTotal + dyTotal * dyTotal > 16) movedRef.current = true;
        const nextX = clamp(
          startRotRef.current.x - dyTotal / dragSensitivity,
          -maxVerticalRotationDeg,
          maxVerticalRotationDeg,
        );
        const nextY = wrapAngleSigned(startRotRef.current.y + dxTotal / dragSensitivity);
        rotationRef.current = { x: nextX, y: nextY };
        applyTransform(nextX, nextY);
        if (last) {
          draggingRef.current = false;
          const [vMagX, vMagY] = velocity;
          const [dirX, dirY] = direction;
          const vx = vMagX * dirX;
          const vy = vMagY * dirY;
          if (Math.abs(vx) > 0.005 || Math.abs(vy) > 0.005) startInertia(vx, vy);
          if (movedRef.current) lastDragEndAt.current = performance.now();
          movedRef.current = false;
        }
      },
    },
    { target: mainRef, eventOptions: { passive: true } },
  );

  const onTileActivate = useCallback(
    (href: string) => {
      if (!href) return;
      if (draggingRef.current || movedRef.current) return;
      if (performance.now() - lastDragEndAt.current < 80) return;
      router.push(href);
    },
    [router],
  );

  return (
    <div
      ref={rootRef}
      className="sphere-root"
      style={{ "--segments-x": segments, "--segments-y": segments } as React.CSSProperties}
      onPointerEnter={() => (hoveredRef.current = true)}
      onPointerLeave={() => (hoveredRef.current = false)}
    >
      <main ref={mainRef} className="sphere-main">
        <div className="stage">
          <div ref={sphereRef} className="sphere">
            {items.map((it, i) => (
              <div
                key={`${it.x},${it.y},${i}`}
                className="sphere-item"
                style={
                  {
                    "--offset-x": it.x,
                    "--offset-y": it.y,
                    "--item-size-x": it.sizeX,
                    "--item-size-y": it.sizeY,
                  } as React.CSSProperties
                }
              >
                <div
                  className="sphere-item__image"
                  role="link"
                  tabIndex={0}
                  aria-label={it.alt || "View product"}
                  title={it.alt}
                  onClick={() => onTileActivate(it.href)}
                  onKeyDown={(e) => e.key === "Enter" && onTileActivate(it.href)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.src} draggable={false} alt={it.alt} loading={i < 60 ? "eager" : "lazy"} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="sphere-overlay" />
        <div className="sphere-edge-fade sphere-edge-fade--top" />
        <div className="sphere-edge-fade sphere-edge-fade--bottom" />
      </main>
    </div>
  );
}
