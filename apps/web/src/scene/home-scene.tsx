"use client";

import { Canvas } from "@react-three/fiber";
import { catchError } from "next/error";
import { useSyncExternalStore } from "react";

import { playSound } from "@/audio/play-sound";
import { clickSound } from "@/audio/sounds";

import { OrbitRig } from "./orbit-rig";
import { Space } from "./space";
import { SpinningShape } from "./spinning-shape";

const HideOnError = catchError(() => null);

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function HomeScene() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="h-dvh w-full">
      <HideOnError>
        <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 6], fov: 40 }}>
          <Space />
          <OrbitRig inertia={!reducedMotion} />
          <SpinningShape
            spinning={!reducedMotion}
            onPress={() => {
              playSound(clickSound);
            }}
          />
        </Canvas>
      </HideOnError>
    </div>
  );
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);

  query.addEventListener("change", onChange);

  return () => {
    query.removeEventListener("change", onChange);
  };
}
