"use client";

import {
  GYM,
  GymCanvas,
  HeavyBagsInPlace,
  Ring,
  WallClockInPlace,
  WreckingBallInPlace,
} from "@no-blank/gym";
import Link from "next/link";
import { type CSSProperties, useState } from "react";
import type { Group, Vector3Tuple } from "three";

import { FreeOrbit } from "./free-orbit";
import type { Subject } from "./subjects";

const SCREEN: CSSProperties = { position: "fixed", inset: 0 };

const BACK: CSSProperties = {
  position: "fixed",
  top: 12,
  left: 12,
  padding: "4px 10px",
  background: "rgba(255, 255, 255, 0.8)",
  color: "#222",
};

// 레킹볼은 천장까지 이어진 막대와 사슬 때문에 한가운데가 공보다 한참 위라서, 공을 바라봅니다.
const FOCUS: Partial<Record<Subject, Vector3Tuple>> = {
  "wrecking-ball": [...GYM.wreckingBall.restCenter],
};

export interface BenchProps {
  readonly subject: Subject;
}

/** 고른 부분 하나만 체육관의 제자리에 두고, 건물과 빛 속에서 자유롭게 돌려 봅니다. */
export function Bench({ subject }: BenchProps) {
  const [shown, setShown] = useState<Group | null>(null);

  return (
    <div style={SCREEN}>
      <GymCanvas reducedMotion={false}>
        <group ref={setShown}>
          <SubjectInPlace subject={subject} />
        </group>
        {shown ? <FreeOrbit around={shown} focus={FOCUS[subject]} /> : null}
      </GymCanvas>
      <Link href="/" style={BACK}>
        목록
      </Link>
    </div>
  );
}

function SubjectInPlace({ subject }: BenchProps) {
  switch (subject) {
    case "ring":
      return <Ring />;
    case "wrecking-ball":
      return (
        <WreckingBallInPlace
          ref={null}
          reducedMotion={false}
          onJolt={ignoreJolt}
        />
      );
    case "heavy-bags":
      return <HeavyBagsInPlace />;
    case "wall-clock":
      return <WallClockInPlace />;
  }
}

function ignoreJolt(): void {}
