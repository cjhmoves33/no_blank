"use client";

import { catchError } from "next/error";
import { useSyncExternalStore } from "react";

import { playSound } from "@/audio/play-sound";
import { clickSound } from "@/audio/sounds";

import { Space } from "./space";
import { SpinningShape } from "./spinning-shape";

const HideOnError = catchError(() => null);

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function HomeScene() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="h-dvh w-full">
      <HideOnError>
        <Space reducedMotion={reducedMotion}>
          <SpinningShape
            spinning={!reducedMotion}
            onPress={() => {
              playSound(clickSound);
            }}
          />
        </Space>
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
