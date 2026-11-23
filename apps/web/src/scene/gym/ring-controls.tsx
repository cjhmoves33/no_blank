import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useEffectEvent, useRef } from "react";
import {
  type Camera,
  MOUSE,
  type Ray,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import type { OrbitLimits } from "./measurements";
import { agedKicks, type Kick, pushedBack } from "./recoil";
import { calmed, shaken, tiltOf } from "./screen-shake";
import {
  dragTo,
  type PointerSample,
  type Press,
  pressDown,
  type PressStep,
  touches,
} from "./wrecking-ball/press";
import type { Strike } from "./wrecking-ball/swing";
import type { WreckingBallHandle } from "./wrecking-ball/wrecking-ball";

export interface RingControlsProps {
  readonly surface: HTMLElement;
  readonly ball: WreckingBallHandle;
  readonly reducedMotion: boolean;
  readonly limits: OrbitLimits;
  readonly onStrike: (strike: Strike) => void;
}

type Cursor = "default" | "pointer" | "grabbing";

const PRIMARY_BUTTON = 0;
const PRIMARY_HELD = 1;
const SECONDARY_HELD = 2;

export function RingControls({
  surface,
  ball,
  reducedMotion,
  limits,
  onStrike,
}: RingControlsProps) {
  const camera = useThree((state) => state.camera);
  const controls = useRef<OrbitControls>(null);
  const orbiting = useRef(false);
  const pointer = useRef<Vector2 | null>(null);
  const trauma = useRef(0);
  const kicks = useRef<Kick[]>([]);
  const pushed = useRef(new Vector3());
  const reportStrike = useEffectEvent(onStrike);

  useEffect(() => {
    const orbit = new OrbitControls(camera, surface);

    orbit.target.set(...limits.target);
    orbit.enablePan = false;
    orbit.minDistance = limits.distance.min;
    orbit.maxDistance = limits.distance.max;
    orbit.minPolarAngle = limits.polar.min;
    orbit.maxPolarAngle = limits.polar.max;
    orbit.mouseButtons = {
      LEFT: null,
      MIDDLE: MOUSE.DOLLY,
      RIGHT: MOUSE.ROTATE,
    };
    orbit.enableDamping = !reducedMotion;
    orbit.update();
    controls.current = orbit;

    return () => {
      orbit.dispose();
      controls.current = null;
    };
  }, [camera, surface, reducedMotion, limits]);

  useEffect(() => {
    let press: Press | null = null;

    const sampleOf = (event: PointerEvent): PointerSample => ({
      ray: rayThrough(camera, ndcOf(surface, event)),
      seconds: event.timeStamp / 1000,
    });

    const land = (step: PressStep): void => {
      press = step.press;

      if (!step.blow) {
        return;
      }

      const strike = ball.take(step.blow);

      if (!reducedMotion) {
        trauma.current = shaken(trauma.current, strike.strength);
        kicks.current = [
          ...kicks.current,
          { age: 0, strength: strike.strength },
        ];
      }

      reportStrike(strike);
    };

    const handleDown = (event: PointerEvent): void => {
      orbiting.current = (event.buttons & SECONDARY_HELD) !== 0;

      const shape = ball.worldShape();

      if (event.button !== PRIMARY_BUTTON || !shape) {
        return;
      }

      surface.setPointerCapture(event.pointerId);
      land(pressDown(sampleOf(event), shape));
    };

    const handleMove = (event: PointerEvent): void => {
      const shape = ball.worldShape();

      orbiting.current = (event.buttons & SECONDARY_HELD) !== 0;
      pointer.current = ndcOf(surface, event);

      if (press && shape) {
        land(dragTo(press, sampleOf(event), shape));
      }
    };

    const handleUp = (event: PointerEvent): void => {
      orbiting.current = (event.buttons & SECONDARY_HELD) !== 0;

      if ((event.buttons & PRIMARY_HELD) === 0) {
        press = null;
      }
    };

    const handleCancel = (): void => {
      orbiting.current = false;
      press = null;
    };

    const handleLeave = (): void => {
      pointer.current = null;
    };

    surface.addEventListener("pointerdown", handleDown);
    surface.addEventListener("pointermove", handleMove);
    surface.addEventListener("pointerup", handleUp);
    surface.addEventListener("pointercancel", handleCancel);
    surface.addEventListener("pointerleave", handleLeave);

    return () => {
      surface.removeEventListener("pointerdown", handleDown);
      surface.removeEventListener("pointermove", handleMove);
      surface.removeEventListener("pointerup", handleUp);
      surface.removeEventListener("pointercancel", handleCancel);
      surface.removeEventListener("pointerleave", handleLeave);
    };
  }, [surface, camera, ball, reducedMotion]);

  useFrame(({ clock }, delta) => {
    // update 는 지금 카메라 위치에서 다음 위치를 구하므로, 지난 프레임에 더한 되밀림을 먼저 빼야 밀림이 쌓이지 않습니다.
    camera.position.sub(pushed.current);
    // 관성은 매 프레임 update 를 불러야 줄어들며 멈춥니다.
    controls.current?.update();
    trauma.current = calmed(trauma.current, delta);

    // update 가 매번 카메라를 target 쪽으로 다시 돌려 놓으므로, 그 뒤에 더한 떨림은 쌓이지 않습니다.
    if (trauma.current > 0) {
      const { pitch, yaw, roll } = tiltOf(trauma.current, clock.elapsedTime);

      camera.rotateX(pitch).rotateY(yaw).rotateZ(roll);
    }

    kicks.current = agedKicks(kicks.current, delta);
    pushed.current = camera.position
      .clone()
      .sub(controls.current?.target ?? camera.position)
      .setLength(pushedBack(kicks.current));
    camera.position.add(pushed.current);

    const shape = ball.worldShape();
    const overBall =
      pointer.current !== null &&
      shape !== null &&
      touches(rayThrough(camera, pointer.current), shape);

    showCursor(surface, cursorFor(orbiting.current, overBall));
  });

  return null;
}

function cursorFor(orbiting: boolean, overBall: boolean): Cursor {
  if (orbiting) {
    return "grabbing";
  }

  return overBall ? "pointer" : "default";
}

function showCursor(surface: HTMLElement, cursor: Cursor): void {
  // OrbitControls 는 없어질 때 커서를 auto 로 되돌리므로(개발 모드에서 effect 를 두 번 돌릴 때 포함), 실제 값과 견주어 다르면 다시 씁니다.
  if (surface.style.cursor !== cursor) {
    surface.style.cursor = cursor;
  }
}

function ndcOf(surface: HTMLElement, event: PointerEvent): Vector2 {
  const box = surface.getBoundingClientRect();

  return new Vector2(
    ((event.clientX - box.left) / box.width) * 2 - 1,
    -((event.clientY - box.top) / box.height) * 2 + 1,
  );
}

function rayThrough(camera: Camera, at: Vector2): Ray {
  const raycaster = new Raycaster();

  raycaster.setFromCamera(at, camera);

  return raycaster.ray;
}
