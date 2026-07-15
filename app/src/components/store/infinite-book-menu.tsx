"use client";

/**
 * Infinite book menu for the home hero, adapted from the React Bits
 * InfiniteMenu (MIT). SLPL changes:
 *  - tiles are rounded 3:4 book covers (SDF mask in the fragment shader),
 *    not stretchy circles, and covers render in colour
 *  - gentler drag with snap-to-book; the focused book shows its title and
 *    a View button; tapping the centered tile opens the product page
 *  - transparent canvas so it sits on the hero panel in both themes
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { mat4, quat, vec2, vec3 } from "gl-matrix";
import { ArrowUpRight } from "lucide-react";

export type BookMenuItem = { image: string; title: string; href: string };

const vertSrc = `#version 300 es
uniform mat4 uWorldMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec4 uRotationAxisVelocity;

in vec3 aModelPosition;
in vec2 aModelUvs;
in mat4 aInstanceMatrix;

out vec2 vUvs;
out float vAlpha;
flat out int vInstanceId;

void main() {
    vec4 worldPosition = uWorldMatrix * aInstanceMatrix * vec4(aModelPosition, 1.);
    vec3 centerPos = (uWorldMatrix * aInstanceMatrix * vec4(0., 0., 0., 1.)).xyz;
    float radius = length(centerPos.xyz);

    // Slight motion stretch. Guard by distance, not gl_VertexID: any vertex
    // sitting exactly at the tile center makes normalize(0) = NaN and blows a
    // hexagonal hole in the tile.
    vec3 rel = worldPosition.xyz - centerPos;
    float relLen = length(rel);
    vec3 axisCross = cross(centerPos, uRotationAxisVelocity.xyz);
    if (relLen > 1e-5 && length(axisCross) > 1e-5) {
        float rotationVelocity = min(.015, uRotationAxisVelocity.w * 1.5);
        vec3 stretchDir = normalize(axisCross);
        vec3 relativeVertexPos = rel / relLen;
        float strength = dot(stretchDir, relativeVertexPos);
        float invAbsStrength = min(0., abs(strength) - 1.);
        strength = rotationVelocity * sign(strength) * abs(invAbsStrength * invAbsStrength * invAbsStrength + 1.);
        worldPosition.xyz += stretchDir * strength;
    }

    worldPosition.xyz = radius * normalize(worldPosition.xyz);
    gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;

    vAlpha = smoothstep(-1., 1., normalize(worldPosition.xyz).z) * .4 + .6;
    vUvs = aModelUvs;
    vInstanceId = gl_InstanceID;
}`;

const fragSrc = `#version 300 es
precision highp float;

uniform sampler2D uTex;
uniform int uItemCount;
uniform int uAtlasSize;

out vec4 outColor;
in vec2 vUvs;
in float vAlpha;
flat in int vInstanceId;

void main() {
    int itemIndex = vInstanceId % uItemCount;
    int cellsPerRow = uAtlasSize;
    int cellX = itemIndex % cellsPerRow;
    int cellY = itemIndex / cellsPerRow;
    vec2 cellSize = vec2(1.0) / vec2(float(cellsPerRow));
    vec2 cellOffset = vec2(float(cellX), float(cellY)) * cellSize;

    // Sample the central 3:4 portion of the square atlas cell
    vec2 st = vec2(vUvs.x * 0.75 + 0.125, 1.0 - vUvs.y);
    st = clamp(st, 0.0, 1.0) * cellSize + cellOffset;
    vec4 color = texture(uTex, st);

    // Rounded-rectangle mask so tiles read as book covers
    vec2 p = abs(vUvs - 0.5) * vec2(0.75, 1.0);
    vec2 half_ = vec2(0.375, 0.5);
    float corner = 0.07;
    vec2 q = p - (half_ - vec2(corner));
    float dist = length(max(q, 0.0)) - corner;
    float mask = 1.0 - smoothstep(-0.008, 0.008, dist);

    // Premultiplied alpha out (the canvas is premultiplied)
    float a = color.a * vAlpha * mask;
    // Never write depth for the masked-out rounded corners: tiles overlap on
    // the sphere and an invisible corner would occlude the tile behind it
    if (a < 0.01) discard;
    outColor = vec4(color.rgb * a, a);
}`;

/* ── Minimal geometry helpers (from the original, trimmed) ─────────────── */

type Buffers = { vertices: Float32Array; uvs: Float32Array; indices: Uint16Array };

/** 3:4 book plane, subdivided so the motion stretch has vertices to bend. */
function bookPlaneGeometry(cols = 6, rows = 8): Buffers {
  const w = 0.75;
  const verts: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x <= cols; x++) {
      const u = x / cols;
      const v = y / rows;
      verts.push((u - 0.5) * w, (v - 0.5) * 1.0, 0);
      uvs.push(u, v);
    }
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const a = y * (cols + 1) + x;
      const b = a + 1;
      const c = a + cols + 1;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  return { vertices: new Float32Array(verts), uvs: new Float32Array(uvs), indices: new Uint16Array(idx) };
}

function icosahedronVertices(radius: number, divisions = 1): vec3[] {
  const t = Math.sqrt(5) * 0.5 + 0.5;
  const base: [number, number, number][] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  let faces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const verts = base.map(([x, y, z]) => vec3.fromValues(x, y, z));
  const midCache = new Map<string, number>();
  const mid = (a: number, b: number) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    const cached = midCache.get(key);
    if (cached !== undefined) return cached;
    const m = vec3.create();
    vec3.add(m, verts[a], verts[b]);
    vec3.scale(m, m, 0.5);
    verts.push(m);
    midCache.set(key, verts.length - 1);
    return verts.length - 1;
  };
  for (let d = 0; d < divisions; d++) {
    const next: [number, number, number][] = [];
    for (const [a, b, c] of faces) {
      const ab = mid(a, b);
      const bc = mid(b, c);
      const ca = mid(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  return verts.map((v) => {
    const out = vec3.create();
    vec3.normalize(out, v);
    vec3.scale(out, out, radius);
    return out;
  });
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) ?? "shader compile failed");
  }
  return sh;
}

/* ── Arcball control (original, damped for easier navigation) ──────────── */

class Arcball {
  isPointerDown = false;
  orientation = quat.create();
  pointerRotation = quat.create();
  rotationVelocity = 0;
  rotationAxis = vec3.fromValues(1, 0, 0);
  snapDirection = vec3.fromValues(0, 0, -1);
  snapTargetDirection: vec3 | null = null;
  private pointerPos = vec2.create();
  private previousPointerPos = vec2.create();
  private _rotationVelocity = 0;
  private _combinedQuat = quat.create();
  private EPSILON = 0.1;
  private IDENTITY = quat.create();

  constructor(
    private canvas: HTMLCanvasElement,
    private updateCallback: (dt: number) => void,
  ) {
    canvas.addEventListener("pointerdown", (e) => {
      vec2.set(this.pointerPos, e.clientX, e.clientY);
      vec2.copy(this.previousPointerPos, this.pointerPos);
      this.isPointerDown = true;
    });
    canvas.addEventListener("pointerup", () => (this.isPointerDown = false));
    canvas.addEventListener("pointerleave", () => (this.isPointerDown = false));
    canvas.addEventListener("pointermove", (e) => {
      if (this.isPointerDown) vec2.set(this.pointerPos, e.clientX, e.clientY);
    });
    canvas.style.touchAction = "none";
  }

  update(dt: number, targetFrame = 16) {
    const timeScale = dt / targetFrame + 0.00001;
    let angleFactor = timeScale;
    const snapRotation = quat.create();

    if (this.isPointerDown) {
      // Halved intensity vs the original: calmer, easier to aim
      const INTENSITY = 0.15 * timeScale;
      const AMPLIFY = 3 / timeScale;
      const mid = vec2.sub(vec2.create(), this.pointerPos, this.previousPointerPos);
      vec2.scale(mid, mid, INTENSITY);
      if (vec2.sqrLen(mid) > this.EPSILON) {
        vec2.add(mid, this.previousPointerPos, mid);
        const p = this.project(mid);
        const q = this.project(this.previousPointerPos);
        const a = vec3.normalize(vec3.create(), p);
        const b = vec3.normalize(vec3.create(), q);
        vec2.copy(this.previousPointerPos, mid);
        angleFactor *= AMPLIFY;
        this.quatFromVectors(a, b, this.pointerRotation, angleFactor);
      } else {
        quat.slerp(this.pointerRotation, this.pointerRotation, this.IDENTITY, INTENSITY);
      }
    } else {
      quat.slerp(this.pointerRotation, this.pointerRotation, this.IDENTITY, 0.1 * timeScale);
      if (this.snapTargetDirection) {
        const a = this.snapTargetDirection;
        const b = this.snapDirection;
        const distanceFactor = Math.max(0.1, 1 - vec3.squaredDistance(a, b) * 10);
        angleFactor *= 0.2 * distanceFactor;
        this.quatFromVectors(a, b, snapRotation, angleFactor);
      }
    }

    const combined = quat.multiply(quat.create(), snapRotation, this.pointerRotation);
    this.orientation = quat.multiply(quat.create(), combined, this.orientation);
    quat.normalize(this.orientation, this.orientation);

    quat.slerp(this._combinedQuat, this._combinedQuat, combined, 0.8 * timeScale);
    quat.normalize(this._combinedQuat, this._combinedQuat);

    const rad = Math.acos(Math.min(1, Math.abs(this._combinedQuat[3]))) * 2.0;
    const s = Math.sin(rad / 2.0);
    let rv = 0;
    if (s > 0.000001) {
      rv = rad / (2 * Math.PI);
      this.rotationAxis[0] = this._combinedQuat[0] / s;
      this.rotationAxis[1] = this._combinedQuat[1] / s;
      this.rotationAxis[2] = this._combinedQuat[2] / s;
    }
    this._rotationVelocity += (rv - this._rotationVelocity) * 0.5 * timeScale;
    this.rotationVelocity = this._rotationVelocity / timeScale;

    this.updateCallback(dt);
  }

  private quatFromVectors(a: vec3, b: vec3, out: quat, angleFactor: number) {
    const axis = vec3.cross(vec3.create(), a, b);
    vec3.normalize(axis, axis);
    const d = Math.max(-1, Math.min(1, vec3.dot(a, b)));
    quat.setAxisAngle(out, axis, Math.acos(d) * angleFactor);
  }

  private project(pos: vec2): vec3 {
    const r = 2;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const s = Math.max(w, h) - 1;
    const x = (2 * pos[0] - w - 1) / s;
    const y = (2 * pos[1] - h - 1) / s;
    const xySq = x * x + y * y;
    const rSq = r * r;
    const z = xySq <= rSq / 2 ? Math.sqrt(rSq - xySq) : rSq / Math.sqrt(xySq);
    return vec3.fromValues(-x, y, z);
  }
}

/* ── Scene ─────────────────────────────────────────────────────────────── */

class BookMenuScene {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private buffers: Buffers;
  private instanceBuffer: WebGLBuffer;
  private matricesArray: Float32Array;
  private matrices: Float32Array[] = [];
  private positions: vec3[];
  private tex: WebGLTexture;
  private atlasSize = 1;
  private control: Arcball;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private camera = {
    position: vec3.fromValues(0, 0, 3),
    view: mat4.create(),
    projection: mat4.create(),
  };
  private world = mat4.create();
  private raf = 0;
  private time = 0;
  private disposed = false;
  private SPHERE_RADIUS = 2;

  movementActive = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private items: BookMenuItem[],
    private onActiveItem: (index: number) => void,
    private onMovementChange: (moving: boolean) => void,
  ) {
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: true });
    if (!gl) throw new Error("WebGL2 not available");
    this.gl = gl;

    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertSrc));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragSrc));
    gl.bindAttribLocation(program, 0, "aModelPosition");
    gl.bindAttribLocation(program, 2, "aModelUvs");
    gl.bindAttribLocation(program, 3, "aInstanceMatrix");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
    }
    this.program = program;
    for (const name of [
      "uWorldMatrix", "uViewMatrix", "uProjectionMatrix", "uRotationAxisVelocity",
      "uTex", "uItemCount", "uAtlasSize",
    ]) {
      this.loc[name] = gl.getUniformLocation(program, name);
    }

    this.buffers = bookPlaneGeometry();
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const posBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.buffers.vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const uvBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.buffers.uvs, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    const idxBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices, gl.STATIC_DRAW);

    this.positions = icosahedronVertices(this.SPHERE_RADIUS);
    const count = this.positions.length;
    this.matricesArray = new Float32Array(count * 16);
    for (let i = 0; i < count; i++) {
      const m = new Float32Array(this.matricesArray.buffer, i * 64, 16);
      mat4.identity(m as unknown as mat4);
      this.matrices.push(m);
    }
    this.instanceBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.matricesArray.byteLength, gl.DYNAMIC_DRAW);
    for (let j = 0; j < 4; j++) {
      gl.enableVertexAttribArray(3 + j);
      gl.vertexAttribPointer(3 + j, 4, gl.FLOAT, false, 64, j * 16);
      gl.vertexAttribDivisor(3 + j, 1);
    }
    gl.bindVertexArray(null);

    this.tex = gl.createTexture()!;
    this.buildAtlas();

    this.control = new Arcball(canvas, (dt) => this.onControlUpdate(dt));
    this.resize();
    this.raf = requestAnimationFrame((t) => this.run(t));
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
  }

  private buildAtlas() {
    const gl = this.gl;
    const itemCount = Math.max(1, this.items.length);
    this.atlasSize = Math.ceil(Math.sqrt(itemCount));
    const cell = 384;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = this.atlasSize * cell;
    const ctx = canvas.getContext("2d")!;

    // Local covers go through the Next image optimizer: a few original PNGs
    // are multi-MB and made the sphere take seconds to appear.
    const thumb = (src: string) =>
      src.startsWith("/") ? `/_next/image?url=${encodeURIComponent(src)}&w=384&q=75` : src;

    Promise.all(
      this.items.map(
        (item) =>
          new Promise<HTMLImageElement | null>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = thumb(item.image);
          }),
      ),
    ).then((images) => {
      if (this.disposed) return;
      images.forEach((img, i) => {
        if (!img) return;
        const x = (i % this.atlasSize) * cell;
        const y = Math.floor(i / this.atlasSize) * cell;
        // Cover-crop into the central 384x512 (3:4) of the square cell
        const dw = cell * 0.75;
        const dx = x + cell * 0.125;
        const scale = Math.max(dw / img.width, cell / img.height);
        const sw = dw / scale;
        const sh = cell / scale;
        const sx = (img.width - sw) / 2;
        const sy = (img.height - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh, dx, y, dw, cell);
      });
      if (window.location.search.includes("debugatlas")) {
        canvas.style.cssText = "position:fixed;inset:0;z-index:9999;width:600px;height:600px;background:#fff";
        document.body.appendChild(canvas);
      }
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    });
  }

  resize() {
    const gl = this.gl;
    const dpr = Math.min(2, window.devicePixelRatio);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    const height = this.SPHERE_RADIUS * 0.38;
    const distance = this.camera.position[2];
    const fov = aspect > 1 ? 2 * Math.atan(height / distance) : 2 * Math.atan(height / aspect / distance);
    mat4.perspective(this.camera.projection, fov, aspect, 0.1, 40);
    this.updateView();
  }

  private updateView() {
    const m = mat4.targetTo(mat4.create(), this.camera.position, [0, 0, 0], [0, 1, 0]);
    mat4.invert(this.camera.view, m);
  }

  private run(time: number) {
    if (this.disposed) return;
    const dt = Math.min(32, time - this.time);
    this.time = time;
    this.control.update(dt);
    this.animate();
    this.render();
    this.raf = requestAnimationFrame((t) => this.run(t));
  }

  private animate() {
    const gl = this.gl;
    // 0.4 reproduces the original component's tile-to-sphere proportion
    // (disc diameter 0.5 on an effective radius-1.5 sphere)
    const scale = 0.45;
    const SCALE_INTENSITY = 0.6;
    let frontZ = -Infinity;
    let frontIdx = 0;
    this.positions.forEach((p, ndx) => {
      const pos = vec3.transformQuat(vec3.create(), p, this.control.orientation);
      const s = (Math.abs(pos[2]) / this.SPHERE_RADIUS) * SCALE_INTENSITY + (1 - SCALE_INTENSITY);
      const finalScale = s * scale;
      const matrix = mat4.create();
      mat4.multiply(matrix, matrix, mat4.fromTranslation(mat4.create(), vec3.negate(vec3.create(), pos)));
      mat4.multiply(matrix, matrix, mat4.targetTo(mat4.create(), [0, 0, 0], pos, [0, 1, 0]));
      mat4.multiply(matrix, matrix, mat4.fromScaling(mat4.create(), [finalScale, finalScale, finalScale]));
      mat4.multiply(matrix, matrix, mat4.fromTranslation(mat4.create(), [0, 0, -this.SPHERE_RADIUS]));
      mat4.copy(this.matrices[ndx] as unknown as mat4, matrix);
      // Ground truth for "which tile is front": the final world translation z
      if (matrix[14] > frontZ) {
        frontZ = matrix[14];
        frontIdx = ndx;
      }
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.matricesArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    // The instance nearest the camera is what the user sees focused
    this.frontIndex = frontIdx;
  }

  private frontIndex = 0;

  private render() {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // Cull the sphere's inside faces (the mirrored ghost tiles)
    gl.enable(gl.CULL_FACE);
    // Depth test keeps back-hemisphere tiles behind the front ones (they all
    // project near the center, so draw order alone is not enough)
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.uniformMatrix4fv(this.loc.uWorldMatrix, false, this.world);
    gl.uniformMatrix4fv(this.loc.uViewMatrix, false, this.camera.view);
    gl.uniformMatrix4fv(this.loc.uProjectionMatrix, false, this.camera.projection);
    gl.uniform4f(
      this.loc.uRotationAxisVelocity,
      this.control.rotationAxis[0],
      this.control.rotationAxis[1],
      this.control.rotationAxis[2],
      this.control.rotationVelocity * 1.1,
    );
    gl.uniform1i(this.loc.uItemCount, this.items.length);
    gl.uniform1i(this.loc.uAtlasSize, this.atlasSize);
    gl.uniform1i(this.loc.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);

    gl.bindVertexArray(this.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, this.buffers.indices.length, gl.UNSIGNED_SHORT, 0, this.positions.length);
    gl.bindVertexArray(null);
  }

  private onControlUpdate(dt: number) {
    const timeScale = dt / 16 + 0.0001;
    let damping = 6 / timeScale;
    let cameraTargetZ = 3;

    const isMoving = this.control.isPointerDown || Math.abs(this.control.rotationVelocity) > 0.01;
    if (isMoving !== this.movementActive) {
      this.movementActive = isMoving;
      this.onMovementChange(isMoving);
    }

    if (!this.control.isPointerDown) {
      const nearest = this.frontIndex;
      this.onActiveItem(nearest % Math.max(1, this.items.length));
      const dir = vec3.transformQuat(vec3.create(), this.positions[nearest], this.control.orientation);
      this.control.snapTargetDirection = vec3.normalize(vec3.create(), dir);
    } else {
      cameraTargetZ += this.control.rotationVelocity * 40 + 1.2; // gentler zoom-out than the original
      damping = 7 / timeScale;
    }
    this.camera.position[2] += (cameraTargetZ - this.camera.position[2]) / damping;
    this.updateView();
  }

}

/* ── React wrapper ─────────────────────────────────────────────────────── */

export default function InfiniteBookMenu({ items }: { items: BookMenuItem[] }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState<BookMenuItem | null>(null);
  const [moving, setMoving] = useState(false);
  const downAt = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || items.length === 0) return;
    let scene: BookMenuScene | null = null;
    try {
      scene = new BookMenuScene(
        canvas,
        items,
        (index) => setActive(items[index % items.length] ?? null),
        setMoving,
      );
    } catch {
      return; // no WebGL2: the section simply stays empty (mobile uses the grid)
    }
    const onResize = () => scene?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      scene?.dispose();
    };
  }, [items]);

  // A press without drag on the canvas opens the focused book
  function onPointerDown(e: React.PointerEvent) {
    downAt.current = { x: e.clientX, y: e.clientY, t: performance.now() };
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = downAt.current;
    downAt.current = null;
    if (!d || !active) return;
    const dist = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (dist < 8 && performance.now() - d.t < 400) router.push(active.href);
  }

  return (
    <div className="book-menu-root">
      <canvas
        ref={canvasRef}
        className="book-menu-canvas"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      />
      {active && (
        <div className={`book-menu-caption ${moving ? "is-moving" : ""}`}>
          <p className="book-menu-title">{active.title}</p>
          <button type="button" className="book-menu-view" onClick={() => router.push(active.href)}>
            View book <ArrowUpRight className="size-4" />
          </button>
        </div>
      )}
      <p className={`book-menu-hint ${moving ? "is-moving" : ""}`}>Drag to explore</p>
    </div>
  );
}
