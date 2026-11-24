export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;

    let t = state;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function addGrain(
  context: CanvasRenderingContext2D,
  amount: number,
  seed: number,
): void {
  const { width, height } = context.canvas;
  const image = context.getImageData(0, 0, width, height);
  const pixels = image.data;
  const random = seededRandom(seed);

  for (let i = 0; i < pixels.length; i += 4) {
    const noise = (random() - 0.5) * amount;

    pixels[i] = (pixels[i] ?? 0) + noise;
    pixels[i + 1] = (pixels[i + 1] ?? 0) + noise;
    pixels[i + 2] = (pixels[i + 2] ?? 0) + noise;
  }

  context.putImageData(image, 0, 0);
}

export type RgbaColor = `rgba(${number}, ${number}, ${number}, ${number})`;

// 캔버스 그라데이션은 알파를 곱하지 않은 채 색을 섞습니다. "transparent"(투명한 검정)로 흐리면 가장자리가 검은 쪽으로 물들어 밝은 색에는 회색 테두리가 생기므로, 같은 색을 알파 0 으로 흐립니다.
export function clearOf(color: RgbaColor): string {
  return `${color.slice(0, color.lastIndexOf(","))}, 0)`;
}

export type BlotchCanvas = Pick<
  CanvasRenderingContext2D,
  "createRadialGradient" | "fillRect" | "fillStyle"
> & { readonly canvas: { readonly width: number; readonly height: number } };

type BlotchWrap = "none" | "horizontal" | "both";

export interface Blotches {
  readonly count: number;
  readonly colors: readonly RgbaColor[];
  readonly maxRadius: number;
  readonly seed: number;
  readonly wrap: BlotchWrap;
}

export function addBlotches(
  context: BlotchCanvas,
  { count, colors, maxRadius, seed, wrap }: Blotches,
): void {
  const { width, height } = context.canvas;
  const random = seededRandom(seed);

  for (let i = 0; i < count; i++) {
    const x = random() * width;
    const y = random() * height;
    const radius = maxRadius * (0.2 + random() * 0.8);
    const color = colors[Math.floor(random() * colors.length)];

    if (!color) {
      continue;
    }

    for (const center of wrappedCenters(
      { x, y, radius },
      context.canvas,
      wrap,
    )) {
      fillBlotch(context, { ...center, radius, color });
    }
  }
}

interface Disk {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

function wrappedCenters(
  { x, y, radius }: Disk,
  { width, height }: BlotchCanvas["canvas"],
  wrap: BlotchWrap,
): { x: number; y: number }[] {
  const xs = wrap === "none" ? [x] : copiesAlong(x, radius, width);
  const ys = wrap === "both" ? copiesAlong(y, radius, height) : [y];

  return xs.flatMap((cx) => ys.map((cy) => ({ x: cx, y: cy })));
}

function copiesAlong(at: number, radius: number, size: number): number[] {
  const reach = Math.ceil(radius / size);

  return Array.from(
    { length: reach * 2 + 1 },
    (_, step) => at + (step - reach) * size,
  ).filter((center) => center + radius > 0 && center - radius < size);
}

function fillBlotch(
  context: BlotchCanvas,
  { x, y, radius, color }: Disk & { readonly color: RgbaColor },
): void {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);

  gradient.addColorStop(0, color);
  gradient.addColorStop(1, clearOf(color));
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
