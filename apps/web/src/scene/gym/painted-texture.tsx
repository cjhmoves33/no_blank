import { useThree } from "@react-three/fiber";
import {
  ClampToEdgeWrapping,
  type ColorSpace,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

/** PaintedTexture 가 처음 쓸 때 한 번만 그립니다. 그 전에는 DOM 을 건드리지 않습니다. */
export interface Painting {
  readonly width: number;
  readonly height: number;
  /** 가장자리가 이어지게 그렸으면 true 이고, 반복해서 깝니다. */
  readonly tiles: boolean;
  readonly paint: (context: CanvasRenderingContext2D) => void;
}

// R3F 는 map 같은 prop 으로 준 텍스처만 sRGB 로 바꾸고 자식으로 붙인 텍스처는 그대로 둡니다.
const SLOT_COLOR_SPACE = {
  map: SRGBColorSpace,
  bumpMap: NoColorSpace,
  aoMap: NoColorSpace,
} as const satisfies Record<string, ColorSpace>;

export interface PaintedTextureProps {
  readonly attach: keyof typeof SLOT_COLOR_SPACE;
  readonly painting: Painting;
  /** 방 전체 좌표(uv1)로 까는 텍스처는 1 입니다. */
  readonly channel?: 0 | 1;
}

/** 재질의 자식으로 둡니다. 재질과 함께 R3F 가 치웁니다. */
export function PaintedTexture({
  attach,
  painting,
  channel = 0,
}: PaintedTextureProps) {
  const anisotropy = useThree((state) =>
    state.gl.capabilities.getMaxAnisotropy(),
  );
  const wrap = painting.tiles ? RepeatWrapping : ClampToEdgeWrapping;

  return (
    <canvasTexture
      attach={attach}
      args={[paintOnce(painting)]}
      colorSpace={SLOT_COLOR_SPACE[attach]}
      wrapS={wrap}
      wrapT={wrap}
      channel={channel}
      anisotropy={anisotropy}
    />
  );
}

const painted = new WeakMap<Painting, HTMLCanvasElement>();

function paintOnce(painting: Painting): HTMLCanvasElement {
  const cached = painted.get(painting);

  if (cached) {
    return cached;
  }

  const canvas = document.createElement("canvas");

  canvas.width = painting.width;
  canvas.height = painting.height;

  // addGrain 이 픽셀을 읽어 옵니다. GPU 캔버스는 읽을 때마다 앞선 그리기를 모두 끝내고 내려받아야 해서 느립니다.
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("2D canvas is not available");
  }

  painting.paint(context);
  painted.set(painting, canvas);

  return canvas;
}

/** mulberry32 입니다. */
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

export interface Blotches {
  readonly count: number;
  readonly colors: readonly string[];
  readonly maxRadius: number;
  readonly seed: number;
}

export function addBlotches(
  context: CanvasRenderingContext2D,
  { count, colors, maxRadius, seed }: Blotches,
): void {
  const { width, height } = context.canvas;
  const random = seededRandom(seed);

  for (let i = 0; i < count; i++) {
    const x = random() * width;
    const y = random() * height;
    const radius = maxRadius * (0.2 + random() * 0.8);
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);

    gradient.addColorStop(
      0,
      colors[Math.floor(random() * colors.length)] ?? "transparent",
    );
    gradient.addColorStop(1, "transparent");
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
}
