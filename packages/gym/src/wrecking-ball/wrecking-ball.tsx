// @refresh reset
import {
  advanceBall,
  type BallMotion,
  type Blow,
  CHAIN_REACH,
  farthestReach,
  HANGING_HEIGHT,
  type Jolt,
  restingBall,
  strikeBall,
} from "@no-blank/ball-motion";
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
import {
  linkCount,
  type LinkPose,
  linksAlong,
  turnedRing,
} from "../chain/chain";
import { ChainLinks, type ChainLinksHandle } from "../chain/chain-links";
import { SWIVEL_EYE, SwivelEye } from "../chain/swivel";
import { STEEL } from "../finishes";
import { GYM } from "../measurements";
import { Hanging, type HangingHandle } from "./hanging";
import {
  age,
  DENT_FEEL,
  dentDepth,
  type Impact,
  type ImpactFeel,
  impactOf,
} from "./impact";
import { Leather, type LeatherHandle } from "./leather";
import type { BallShape } from "./press";
import { flattening, SQUASH_FEEL, squashMatrix } from "./squash";
import { StrikeDust, type StrikeDustHandle } from "./strike-dust";

export interface Strike {
  readonly strength: number;
}

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
const X = new Vector3(1, 0, 0);
const Z = new Vector3(0, 0, 1);
const SWEEP = farthestReach() + radius;

export const WRECKING_BALL_SIZE: Box = {
  min: [-SWEEP, -radius, -SWEEP],
  max: [SWEEP, CHAIN_REACH, SWEEP],
};

const RESTING_CHAIN = upperChain(restingBall().swing.fromPivot);

export function WreckingBall({
  reducedMotion,
  ref,
  onJolt,
}: WreckingBallProps) {
  const ball = useRef<Group>(null);
  const leather = useRef<LeatherHandle>(null);
  const squashed = useRef<Group>(null);
  const hanging = useRef<HangingHandle>(null);
  const dust = useRef<StrikeDustHandle>(null);
  const chain = useRef<ChainLinksHandle>(null);
  const eye = useRef<Mesh>(null);
  const motion = useRef(restingBall());
  const impact = useRef<Impact | null>(null);
  const feel = reducedMotion ? "reduced" : "normal";

  useImperativeHandle(
    ref,
    () => ({
      worldShape: () => (ball.current ? shapeOf(ball.current) : null),
      take: (blow) => {
        const struck = strikeBall(motion.current, blow);
        const { strength } = struck;
        const toLeather = ball.current?.quaternion.clone().invert();
        const dent = toLeather
          ? impactOf(
              blow.hitFromCenter.clone().applyQuaternion(toLeather),
              strength,
            )
          : null;
        const center = ball.current?.getWorldPosition(new Vector3());

        motion.current = struck.motion;
        impact.current = dent ?? impact.current;

        if (center) {
          dust.current?.burst(
            center.add(blow.hitFromCenter),
            blow.hitFromCenter,
            strength,
          );
        }

        return { strength };
      },
    }),
    [],
  );

  useFrame((_state, delta) => {
    const seconds = Math.min(delta, LONGEST_FRAME);
    const advanced = advanceBall(motion.current, seconds);

    motion.current = advanced.motion;
    impact.current = impact.current
      ? age(impact.current, advanced.movingSeconds)
      : null;

    if (advanced.jolt) {
      onJolt(advanced.jolt);
    }

    showImpact(impact.current, {
      leather: leather.current,
      squashed: squashed.current,
      hanging: hanging.current,
      feel,
    });

    const { swing, lean, twist } = motion.current;
    const { fromPivot } = swing;
    const pose = hangingPose(fromPivot, lean, twist.angle);

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
          <Hanging ref={hanging} />
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
    hanging,
    feel,
  }: {
    readonly leather: LeatherHandle | null;
    readonly squashed: Group | null;
    readonly hanging: HangingHandle | null;
    readonly feel: ImpactFeel;
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

  const squash = squashMatrix(
    impact?.onLeather ?? UP,
    impact ? flattening(impact, SQUASH_FEEL[feel]) : 0,
  );

  if (squashed) {
    squashed.matrix.copy(squash);
    squashed.matrixWorldNeedsUpdate = true;
  }

  hanging?.follow(squash);
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
  lean: BallMotion["lean"],
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

function leanTurn(lean: BallMotion["lean"]): Quaternion {
  return new Quaternion()
    .setFromAxisAngle(X, lean.aboutX.angle)
    .multiply(new Quaternion().setFromAxisAngle(Z, lean.aboutZ.angle));
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
