"use client";

import { Gym, LATE_AFTERNOON } from "@no-blank/gym";
import { catchError } from "next/error";
import { useSyncExternalStore } from "react";

import { playSound } from "@/audio/play-sound";
import { chainSound, strikeSound } from "@/audio/sounds";

const HideOnError = catchError(() => null);

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const PAGE = { background: LATE_AFTERNOON.background };

export function HomeScene() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="h-dvh w-full" style={PAGE}>
      <HideOnError>
        <Gym
          reducedMotion={reducedMotion}
          onStrike={(strike) => {
            playSound(strikeSound(strike.strength));
          }}
          onJolt={(jolt) => {
            playSound(chainSound(jolt.strength));
          }}
        />
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
