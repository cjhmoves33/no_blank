const CLICK_SLOP_PX = 4;

interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

type PointerSurface = Pick<
  HTMLElement,
  "addEventListener" | "removeEventListener"
>;

export function swallowClicksAfterDrag(surface: PointerSurface): () => void {
  let clickOrigin: ScreenPoint | undefined;

  const handlePointerDown = (event: PointerEvent): void => {
    clickOrigin = { x: event.clientX, y: event.clientY };
  };

  const handlePointerMove = (event: PointerEvent): void => {
    if (clickOrigin && distanceTo(clickOrigin, event) > CLICK_SLOP_PX) {
      clickOrigin = undefined;
    }
  };

  const handleClick = (event: MouseEvent): void => {
    if (!clickOrigin) {
      event.stopImmediatePropagation();
    }
  };

  surface.addEventListener("pointerdown", handlePointerDown);
  surface.addEventListener("pointermove", handlePointerMove);
  surface.addEventListener("click", handleClick, { capture: true });

  return () => {
    surface.removeEventListener("pointerdown", handlePointerDown);
    surface.removeEventListener("pointermove", handlePointerMove);
    surface.removeEventListener("click", handleClick, { capture: true });
  };
}

function distanceTo(
  origin: ScreenPoint,
  pointer: { readonly clientX: number; readonly clientY: number },
): number {
  return Math.hypot(pointer.clientX - origin.x, pointer.clientY - origin.y);
}
