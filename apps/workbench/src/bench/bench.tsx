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

const LOOK_AT_REST: Partial<Record<Subject, Vector3Tuple>> = {
  "wrecking-ball": [...GYM.wreckingBall.restCenter],
};

export interface BenchProps {
  readonly subject: Subject;
}

export function Bench({ subject }: BenchProps) {
  const [shown, setShown] = useState<Group | null>(null);

  return (
    <div style={SCREEN}>
      <GymCanvas reducedMotion={false}>
        <group ref={setShown}>
          <SubjectInPlace subject={subject} />
        </group>
        {shown ? (
          <FreeOrbit around={shown} lookAt={LOOK_AT_REST[subject]} />
        ) : null}
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
