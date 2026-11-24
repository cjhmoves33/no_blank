import Link from "next/link";
import type { CSSProperties } from "react";

import { SUBJECTS } from "@/bench/subjects";

const PAGE: CSSProperties = { padding: 24 };

export default function SubjectList() {
  return (
    <main style={PAGE}>
      <h1>작업대</h1>
      <ul>
        {SUBJECTS.map(({ slug, name }) => (
          <li key={slug}>
            <Link href={`/${slug}`}>{name}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
