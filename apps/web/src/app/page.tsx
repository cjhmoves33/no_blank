import { Suspense } from "react";

import { getGreeting } from "@/lib/api";
import { HomeScene } from "@/scene/home-scene";

async function Greeting() {
  const { message } = await getGreeting();

  return (
    <h1 className="text-5xl font-semibold tracking-tight text-black dark:text-zinc-50">
      {message}
    </h1>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 font-sans dark:bg-black">
      <HomeScene />
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <Greeting />
      </Suspense>
      <p className="text-sm text-zinc-500">
        Next.js (SSR) → Fastify API → PostgreSQL
      </p>
    </main>
  );
}
