"use client";

import { Canvas } from "@react-three/fiber";
import { catchError } from "next/error";
import { useSyncExternalStore } from "react";

import { playSound } from "@/audio/play-sound";
import { clickSound } from "@/audio/sounds";

import { SpinningShape } from "./spinning-shape";

const HideOnError = catchError(() => null);

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function HomeScene() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="size-80">
      <HideOnError>
        <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 4], fov: 40 }}>
          <hemisphereLight args={["#ffffff", "#c7d2fe", 0.8]} />
          <directionalLight position={[3, 4, 5]} intensity={2} />
          <directionalLight
            position={[-4, -2, -3]}
            intensity={0.6}
            color="#a5b4fc"
          />
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
