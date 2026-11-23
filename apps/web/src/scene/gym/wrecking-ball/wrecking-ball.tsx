// @refresh reset
import { useFrame } from "@react-three/fiber";
import { type Ref, useImperativeHandle, useRef } from "react";
import {
  type Group,
  type Mesh,
  Plane,
  Quaternion,
  Sphere,
  Vector3,
} from "three";

import type { Box } from "../building/slabs";
import { STEEL } from "../finishes";
import { GYM } from "../measurements";
import { linkCount, type LinkPose, linksAlong, turnedRing } from "./chain";
import { ChainLinks, type ChainLinksHandle } from "./chain-links";
import { Hanging, HANGING_HEIGHT, SWIVEL_EYE, SwivelEye } from "./hanging";
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
import { Leather, type LeatherHandle } from "./leather";
import type { BallShape } from "./press";
import { RESTING_SPRING } from "./spring";
import { flattening, SQUASH_FEEL, squashMatrix } from "./squash";
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
import { spinDown, TWIST_FEEL, twistBy } from "./twist";

export interface WreckingBallHandle {
  readonly worldShape: () => BallShape | null;
  readonly take: (blow: Blow) => Strike;
}

export interface WreckingBallProps {
  readonly reducedMotion: boolean;
  readonly ref: Ref<WreckingBallHandle>;
  readonly onJolt: (jolt: Jolt) => void;
}

const { radius, lidHeight, pivotY } = GYM.wreckingBall;
const TO_CEILING = GYM.building.ceilingY - pivotY;

const ROD_RADIUS = 0.02;
const CHAIN_LENGTH = CHAIN_REACH - HANGING_HEIGHT;
const LINKS = linkCount(CHAIN_LENGTH);
// 탭이 가려졌다 돌아오면 delta 가 몇 초가 되므로, 그동안의 흔들림은 건너뜁니다.
const LONGEST_FRAME = 0.1;
const UP = new Vector3(0, 1, 0);
const SWEEP = farthestReach() + radius;

export const WRECKING_BALL_SIZE: Box = {
  min: [-SWEEP, -radius, -SWEEP],
  max: [SWEEP, CHAIN_REACH, SWEEP],
};

const RESTING_CHAIN = upperChain(restingSwing().fromPivot);

export function WreckingBall({
  reducedMotion,
  ref,
  onJolt,
}: WreckingBallProps) {
  const ball = useRef<Group>(null);
  const leather = useRef<LeatherHandle>(null);
  const squashed = useRef<Group>(null);
  const dust = useRef<StrikeDustHandle>(null);
  const chain = useRef<ChainLinksHandle>(null);
  const eye = useRef<Mesh>(null);
  const swing = useRef(restingSwing());
  const twist = useRef(RESTING_SPRING);
  const lean = useRef<Lean>(UPRIGHT);
  const impact = useRef<Impact | null>(null);
  const feel = reducedMotion ? "reduced" : "normal";

  useImperativeHandle(
    ref,
    () => ({
      worldShape: () => (ball.current ? shapeOf(ball.current) : null),
      take: (blow) => {
        const struck = strike(swing.current, blow, SWING_FEEL[feel]);
        const { strength } = struck.strike;
        const toLeather = ball.current?.quaternion.clone().invert();
        const dent = toLeather
          ? impactOf(
              blow.hitFromCenter.clone().applyQuaternion(toLeather),
              strength,
            )
          : null;
        const center = ball.current?.getWorldPosition(new Vector3());

        swing.current = struck.swing;
        twist.current = twistBy(
          twist.current,
          { blow, strength },
          TWIST_FEEL[feel],
        );
        lean.current = leanBy(
          lean.current,
          { hitFromCenter: blow.hitFromCenter, push: struck.push, strength },
          LEAN_FEEL[feel],
        );
        impact.current = dent ?? impact.current;

        if (center) {
          dust.current?.burst(
            center.add(blow.hitFromCenter),
            blow.hitFromCenter,
            strength,
          );
        }

        return struck.strike;
      },
    }),
    [feel],
  );

  useFrame((_state, delta) => {
    const seconds = Math.min(delta, LONGEST_FRAME);
    const aged = impact.current
      ? age(impact.current, seconds)
      : { impact: null, movingSeconds: seconds };

    impact.current = aged.impact;
    swing.current = advance(
      swing.current,
      aged.movingSeconds,
      SWING_FEEL[feel],
    );
    twist.current = spinDown(
      twist.current,
      aged.movingSeconds,
      TWIST_FEEL[feel],
    );
    lean.current = settleLean(
      lean.current,
      aged.movingSeconds,
      LEAN_FEEL[feel],
    );

    const jolt = joltOf(swing.current);

    if (jolt) {
      lean.current = leanByJolt(
        lean.current,
        swing.current.velocity,
        LEAN_FEEL[feel],
      );
      onJolt(jolt);
    }

    showImpact(impact.current, {
      leather: leather.current,
      squashed: squashed.current,
      feel,
    });

    const { fromPivot } = swing.current;
    const pose = hangingPose(fromPivot, lean.current, twist.current.angle);

    ball.current?.position.copy(pose.position);
    ball.current?.quaternion.copy(pose.quaternion);
    hangChain(upperChain(fromPivot), {
      chain: chain.current,
      eye: eye.current,
    });
  });

  return (
    <>
      <mesh castShadow receiveShadow position-y={CHAIN_REACH + TO_CEILING / 2}>
        <cylinderGeometry args={[ROD_RADIUS, ROD_RADIUS, TO_CEILING, 8]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <group position-y={CHAIN_REACH}>
        <ChainLinks
          ref={chain}
          name="upper-chain"
          poses={RESTING_CHAIN.links}
        />
        <SwivelEye
          ref={eye}
          position={RESTING_CHAIN.eye.position}
          quaternion={RESTING_CHAIN.eye.quaternion}
        />
        <group ref={ball} position-y={-CHAIN_REACH}>
          <group ref={squashed} matrixAutoUpdate={false}>
            <Leather ref={leather} />
          </group>
          <Hanging />
        </group>
      </group>
      {reducedMotion ? null : <StrikeDust ref={dust} />}
    </>
  );
}

function showImpact(
  impact: Impact | null,
  {
    leather,
    squashed,
    feel,
  }: {
    readonly leather: LeatherHandle | null;
    readonly squashed: Group | null;
    readonly feel: keyof typeof SWING_FEEL;
  },
): void {
  leather?.dent(
    impact
      ? {
          onLeather: impact.onLeather,
          depth: dentDepth(impact, DENT_FEEL[feel]),
        }
      : null,
  );

  if (squashed) {
    squashed.matrix.copy(
      squashMatrix(
        impact?.onLeather ?? UP,
        impact ? flattening(impact, SQUASH_FEEL[feel]) : 0,
      ),
    );
    squashed.matrixWorldNeedsUpdate = true;
  }
}

function shapeOf(ball: Group): BallShape {
  const center = ball.getWorldPosition(new Vector3());
  const up = UP.clone().applyQuaternion(
    ball.getWorldQuaternion(new Quaternion()),
  );

  return {
    sphere: new Sphere(center, radius),
    lid: new Plane().setFromNormalAndCoplanarPoint(
      up,
      center.clone().addScaledVector(up, lidHeight),
    ),
  };
}

function hangingPose(
  fromPivot: Vector3,
  lean: Lean,
  twist: number,
): { readonly position: Vector3; readonly quaternion: Quaternion } {
  const tilt = leanTurn(lean);
  const toPivot = fromPivot.clone().negate().normalize();
  const hinge = fromPivot.clone().addScaledVector(toPivot, HANGING_HEIGHT);

  return {
    position: toPivot
      .clone()
      .multiplyScalar(-HANGING_HEIGHT)
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

interface UpperChain {
  readonly links: LinkPose[];
  readonly eye: LinkPose;
}

function upperChain(fromPivot: Vector3): UpperChain {
  const end = fromPivot
    .clone()
    .addScaledVector(fromPivot.clone().negate().normalize(), HANGING_HEIGHT);
  const bow = visibleBendSide(fromPivot).multiplyScalar(
    sagOfSlackChain(end.length()),
  );
  const path = (t: number) =>
    end
      .clone()
      .multiplyScalar(t)
      .addScaledVector(bow, 4 * t * (1 - t));
  const links = linksAlong(path, LINKS);
  const last = links.at(-1);
  const downward = end.clone().sub(path(0.99)).normalize();

  return {
    links,
    eye: {
      position: end.clone().addScaledVector(downward, SWIVEL_EYE.radius),
      quaternion: last ? turnedRing(last) : new Quaternion(),
    },
  };
}

function hangChain(
  { links, eye }: UpperChain,
  {
    chain,
    eye: eyeMesh,
  }: { readonly chain: ChainLinksHandle | null; readonly eye: Mesh | null },
): void {
  chain?.place(links);
  eyeMesh?.position.copy(eye.position);
  eyeMesh?.quaternion.copy(eye.quaternion);
}

function sagOfSlackChain(span: number): number {
  const slack = Math.max(CHAIN_LENGTH - span, 0);

  return Math.sqrt((3 * span * slack) / 8);
}

function visibleBendSide(fromPivot: Vector3): Vector3 {
  const side = new Vector3(fromPivot.x, 0, fromPivot.z).cross(UP);

  return side.lengthSq() > 0 ? side.normalize() : new Vector3(1, 0, 0);
}
