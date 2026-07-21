import Link from "next/link";
import Image from "next/image";

export type ConveyorCover = { src: string; title: string; href: string };

/**
 * Hero frame: a conveyor of real covers running clockwise around the border
 * of the hero box (top edge right, right edge down, bottom edge left, left
 * edge up), with the hero copy in the centre. Pure CSS marquees on the
 * compositor (transform-gpu + will-change) so they stay smooth; hover pauses
 * a strip, prefers-reduced-motion stops them, every cover links to its book.
 */

const COVER_W = 88;
const COVER_H = 117;
const EDGE = 128; // strip thickness incl. inset

function Strip({
  covers,
  direction,
  className,
  style,
}: {
  covers: ConveyorCover[];
  direction: "right" | "down" | "left" | "up";
  className: string;
  style?: React.CSSProperties;
}) {
  const vertical = direction === "up" || direction === "down";
  const anim =
    direction === "right"
      ? "conveyor-x-reverse"
      : direction === "left"
        ? "conveyor-x"
        : direction === "down"
          ? "conveyor-y-reverse"
          : "conveyor-y";
  const loop = [...covers, ...covers];
  return (
    <div className={`group absolute overflow-hidden ${className}`} style={{ contain: "layout paint", ...style }}>
      <div
        className={`${anim} flex ${vertical ? "w-max flex-col" : "h-max"} transform-gpu items-center gap-3 will-change-transform motion-reduce:animate-none`}
        style={{ animationDuration: `${covers.length * 7}s` }}
      >
        {loop.map((c, i) => (
          <Link
            key={`${c.src}-${i}`}
            href={c.href}
            title={c.title}
            className="block h-[88px] w-[66px] shrink-0 overflow-hidden rounded-lg border bg-muted shadow-sm transition-transform hover:scale-105 sm:h-[117px] sm:w-[88px]"
          >
            <Image
              src={c.src}
              alt={c.title}
              width={COVER_W}
              height={COVER_H}
              className="h-full w-full object-cover"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function HeroConveyor({
  covers,
  children,
}: {
  covers: ConveyorCover[];
  children: React.ReactNode;
}) {
  // Each edge gets its own slice of the pool (with a minimum so short
  // catalogs still loop seamlessly), keeping total image count low.
  const half = Math.ceil(covers.length / 2);
  const top = covers.slice(0, half);
  const bottom = covers.slice(half).length >= 6 ? covers.slice(half) : covers;
  const left = covers.filter((_, i) => i % 3 === 0).slice(0, 8);
  const right = covers.filter((_, i) => i % 3 === 1).slice(0, 8);

  return (
    <div className="relative">
      <Strip covers={top} direction="right" className="inset-x-3 top-3 h-[88px] sm:h-[117px]" />
      <Strip covers={bottom} direction="left" className="inset-x-3 bottom-3 h-[88px] sm:h-[117px]" />
      {/* vertical strips run between the two horizontal ones */}
      <Strip
        covers={right.length >= 4 ? right : top}
        direction="down"
        className="right-3 hidden lg:block"
        style={{ width: COVER_W, top: EDGE + 8, bottom: EDGE + 8 }}
      />
      <Strip
        covers={left.length >= 4 ? left : bottom}
        direction="up"
        className="left-3 hidden lg:block"
        style={{ width: COVER_W, top: EDGE + 8, bottom: EDGE + 8 }}
      />

      {/* Centre content; wrapper ignores the pointer so covers stay clickable */}
      <div className="pointer-events-none relative z-10 mx-auto max-w-5xl px-4 py-[106px] sm:px-8 sm:py-[140px] lg:px-[120px]">
        <div className="pointer-events-auto rounded-2xl bg-[color:var(--dome-overlay)]/85 p-3 backdrop-blur-[2px] sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
