"use client";

import { Gym, LATE_AFTERNOON } from "@no-blank/gym";
import { catchError } from "next/error";
import { type RefObject, useEffect, useRef, useSyncExternalStore } from "react";

import { playSound } from "@/audio/play-sound";
import { loadRecordings } from "@/audio/recordings";
import { joltSound, strikeSound } from "@/audio/sounds";
import { connectToHome } from "@/lib/home-connection";

const HideOnError = catchError(() => null);

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const PAGE = { background: LATE_AFTERNOON.background };

export function HomeScene() {
  const reducedMotion = usePrefersReducedMotion();
  const gym = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadRecordings();
  }, []);

  useHomeConnection(gym);

  return (
    <div ref={gym} className="h-dvh w-full" style={PAGE}>
      <HideOnError>
        <Gym
          reducedMotion={reducedMotion}
          onStrike={(strike) => {
            playSound(strikeSound(strike.strength));
          }}
          onJolt={(jolt) => {
            playSound(joltSound(jolt.strength));
          }}
        />
      </HideOnError>
    </div>
  );
}

function useHomeConnection(gym: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const connection = connectToHome(() => {});
    const element = gym.current;

    function noticeActivity(): void {
      connection.noticeActivity();
    }

    function noticeReturn(): void {
      if (document.visibilityState === "visible") {
        connection.noticeActivity();
      }
    }

    element?.addEventListener("pointermove", noticeActivity);
    document.addEventListener("visibilitychange", noticeReturn);

    return () => {
      element?.removeEventListener("pointermove", noticeActivity);
      document.removeEventListener("visibilitychange", noticeReturn);
      connection.close();
    };
  }, [gym]);
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
