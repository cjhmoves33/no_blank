import { notFound } from "next/navigation";

import { Bench } from "@/bench/bench";
import { subjectOf } from "@/bench/subjects";

// PageProps 는 next typegen 이 만드는 전역 타입이라, typegen 보다 먼저 도는 lint 와 lint-staged 에서는 풀리지 않습니다.
interface SubjectPageProps {
  readonly params: Promise<{ readonly subject: string }>;
}

export default async function SubjectPage({ params }: SubjectPageProps) {
  const subject = subjectOf((await params).subject);

  if (!subject) {
    notFound();
  }

  return <Bench subject={subject} />;
}
