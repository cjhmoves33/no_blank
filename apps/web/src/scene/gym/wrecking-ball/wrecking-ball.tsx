import { useFrame } from "@react-three/fiber";
import { type Ref, useImperativeHandle, useRef } from "react";
import { type Group, type Mesh, Quaternion, Sphere, Vector3 } from "three";

import type { Box } from "../building/slabs";
import { STEEL } from "../finishes";
import { GYM } from "../measurements";
import { age, DENT_FEEL, dentDepth, type Impact, impactOf } from "./impact";
import {
  type Lean,
  LEAN_FEEL,
  leanBy,
  leanByJolt,
  leanTurn,
  settleLean,
  UPRIGHT,
} from "./lean";
import { HANGING_POINT, Leather, type LeatherHandle } from "./leather";
import { RESTING_SPRING, settle } from "./spring";
import { StrikeDust, type StrikeDustHandle } from "./strike-dust";
import {
  advance,
  type Blow,
  CHAIN_REACH,
  farthestReach,
  type Jolt,
  joltOf,
  restingSwing,
  type Strike,
  strike,
  SWING_FEEL,
} from "./swing";
import { TWIST_FEEL, twistBy } from "./twist";

export interface WreckingBallHandle {
  readonly sphere: () => Sphere | null;
  readonly take: (blow: Blow) => Strike;
}

export interface WreckingBallProps {
  readonly reducedMotion: boolean;
  readonly ref: Ref<WreckingBallHandle>;
  readonly onJolt: (jolt: Jolt) => void;
}

const { radius, pivotY } = GYM.wreckingBall;
const TO_CEILING = GYM.building.ceilingY - pivotY;

const CHAIN_RADIUS = 0.0125;
const ROD_RADIUS = 0.02;
const CHAIN_LENGTH = CHAIN_REACH - HANGING_POINT;
const PIVOT = new Vector3(0, CHAIN_REACH, 0);
const LINKS = 12;
// 탭이 가려졌다 돌아오면 delta 가 몇 초가 되므로, 그동안의 흔들림은 건너뜁니다.
const LONGEST_FRAME = 0.1;
const UP = new Vector3(0, 1, 0);
const SWEEP = farthestReach() + radius;

export const WRECKING_BALL_SIZE: Box = {
  min: [-SWEEP, -radius, -SWEEP],
  max: [SWEEP, CHAIN_REACH, SWEEP],
};

const REST_LINKS = chainLinks(restingSwing().fromPivot);

export function WreckingBall({
  reducedMotion,
  ref,
  onJolt,
}: WreckingBallProps) {
  const ball = useRef<Group>(null);
  const leather = useRef<LeatherHandle>(null);
  const dust = useRef<StrikeDustHandle>(null);
  const links = useRef<(Mesh | null)[]>([]);
  const swing = useRef(restingSwing());
  const twist = useRef(RESTING_SPRING);
  const lean = useRef<Lean>(UPRIGHT);
  const impact = useRef<Impact | null>(null);
  const feel = reducedMotion ? "reduced" : "normal";

  useImperativeHandle(
    ref,
    () => ({
      sphere: () =>
        ball.current
          ? new Sphere(ball.current.getWorldPosition(new Vector3()), radius)
          : null,
      take: (blow) => {
        const struck = strike(swing.current, blow, SWING_FEEL[feel]);
        const { strength } = struck.strike;
        const toLeather = ball.current?.quaternion.clone().invert();
        const dent = toLeather
          ? impactOf(blow.at.clone().applyQuaternion(toLeather), strength)
          : null;

        swing.current = struck.swing;
        twist.current = twistBy(twist.current, blow, strength);
        lean.current = leanBy(
          lean.current,
          { at: blow.at, push: struck.push, strength },
          LEAN_FEEL[feel],
        );
        impact.current = dent ?? impact.current;
        dust.current?.burst(
          PIVOT.clone()
            .add(ball.current?.position ?? struck.swing.fromPivot)
            .add(blow.at),
          blow.at.clone().normalize(),
          strength,
        );

        return struck.strike;
      },
    }),
    [feel],
  );

  useFrame((_state, delta) => {
    const seconds = Math.min(delta, LONGEST_FRAME);
    const aged = impact.current
      ? age(impact.current, seconds)
      : { impact: null, moving: seconds };

    impact.current = aged.impact;
    swing.current = advance(swing.current, aged.moving, SWING_FEEL[feel]);
    twist.current = settle(twist.current, aged.moving, TWIST_FEEL[feel]);
    lean.current = settleLean(lean.current, aged.moving, LEAN_FEEL[feel]);

    const jolt = joltOf(swing.current);

    if (jolt) {
      lean.current = leanByJolt(
        lean.current,
        swing.current.velocity,
        LEAN_FEEL[feel],
      );
      onJolt(jolt);
    }

    leather.current?.dent(
      impact.current
        ? {
            at: impact.current.at,
            depth: dentDepth(impact.current, DENT_FEEL[feel]),
          }
        : null,
    );

    const { fromPivot } = swing.current;
    const pose = hangingPose(fromPivot, lean.current, twist.current.angle);

    ball.current?.position.copy(pose.position);
    ball.current?.quaternion.copy(pose.quaternion);
    chainLinks(fromPivot).forEach((link, i) => {
      const mesh = links.current[i];

      mesh?.position.copy(link.position);
      mesh?.quaternion.copy(link.quaternion);
      mesh?.scale.setY(link.length);
    });
  });

  return (
    <>
      <mesh castShadow receiveShadow position-y={CHAIN_REACH + TO_CEILING / 2}>
        <cylinderGeometry args={[ROD_RADIUS, ROD_RADIUS, TO_CEILING, 8]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <group position-y={CHAIN_REACH}>
        {REST_LINKS.map((link, i) => (
          <mesh
            key={i}
            ref={(mesh) => {
              links.current[i] = mesh;
            }}
            castShadow
            receiveShadow
            position={link.position}
            quaternion={link.quaternion}
            scale-y={link.length}
          >
            <cylinderGeometry args={[CHAIN_RADIUS, CHAIN_RADIUS, 1, 6]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        ))}
        <group ref={ball} position-y={-CHAIN_REACH}>
          <Leather ref={leather} />
        </group>
      </group>
      {reducedMotion ? null : <StrikeDust ref={dust} />}
    </>
  );
}

function hangingPose(
  fromPivot: Vector3,
  lean: Lean,
  twist: number,
): { readonly position: Vector3; readonly quaternion: Quaternion } {
  const tilt = leanTurn(lean);
  const toPivot = fromPivot.clone().negate().normalize();
  const hinge = fromPivot.clone().addScaledVector(toPivot, HANGING_POINT);

  return {
    position: toPivot
      .clone()
      .multiplyScalar(-HANGING_POINT)
      .applyQuaternion(tilt)
      .add(hinge),
    quaternion: tilt
      .multiply(facingPivot(fromPivot))
      .multiply(aroundCap(twist)),
  };
}

function facingPivot(fromPivot: Vector3): Quaternion {
  return new Quaternion().setFromUnitVectors(
    UP,
    fromPivot.clone().negate().normalize(),
  );
}

function aroundCap(angle: number): Quaternion {
  return new Quaternion().setFromAxisAngle(UP, angle);
}

interface ChainLink {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
  readonly length: number;
}

function chainLinks(fromPivot: Vector3): ChainLink[] {
  const end = fromPivot
    .clone()
    .addScaledVector(fromPivot.clone().negate().normalize(), HANGING_POINT);
  const bow = visibleBendSide(fromPivot).multiplyScalar(
    sagOfSlackChain(end.length()),
  );
  const along = (t: number) =>
    end
      .clone()
      .multiplyScalar(t)
      .addScaledVector(bow, 4 * t * (1 - t));

  return Array.from({ length: LINKS }, (_, i) => {
    const from = along(i / LINKS);
    const to = along((i + 1) / LINKS);
    const length = from.distanceTo(to);

    return {
      position: from.clone().add(to).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(
        UP,
        to.clone().sub(from).divideScalar(length),
      ),
      length,
    };
  });
}

function sagOfSlackChain(span: number): number {
  const slack = Math.max(CHAIN_LENGTH - span, 0);

  return Math.sqrt((3 * span * slack) / 8);
}

function visibleBendSide(fromPivot: Vector3): Vector3 {
  const side = new Vector3(fromPivot.x, 0, fromPivot.z).cross(UP);

  return side.lengthSq() > 0 ? side.normalize() : new Vector3(1, 0, 0);
}
