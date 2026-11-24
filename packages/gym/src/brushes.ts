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

type RgbaColor = `rgba(${number}, ${number}, ${number}, ${number})`;

// 캔버스 그라데이션은 알파를 곱하지 않은 채 색을 섞습니다. "transparent"(투명한 검정)로 흐리면 밝은 얼룩의 가장자리가 회색이 되므로, 같은 색을 알파 0 으로 흐립니다.
function clearOf(color: RgbaColor): string {
  return `${color.slice(0, color.lastIndexOf(","))}, 0)`;
}

export type BlotchCanvas = Pick<
  CanvasRenderingContext2D,
  "createRadialGradient" | "fillRect" | "fillStyle"
> & { readonly canvas: { readonly width: number; readonly height: number } };

export interface Blotches {
  readonly count: number;
  readonly colors: readonly RgbaColor[];
  readonly maxRadius: number;
  readonly seed: number;
}

export function addBlotches(
  context: BlotchCanvas,
  { count, colors, maxRadius, seed }: Blotches,
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

    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);

    gradient.addColorStop(0, color);
    gradient.addColorStop(1, clearOf(color));
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
}
