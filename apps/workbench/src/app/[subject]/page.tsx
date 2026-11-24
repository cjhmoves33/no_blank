import { notFound } from "next/navigation";

import { Bench } from "@/bench/bench";
import { subjectOf } from "@/bench/subjects";

export default async function SubjectPage({ params }: PageProps<"/[subject]">) {
  const subject = subjectOf((await params).subject);

  if (!subject) {
    notFound();
  }

  return <Bench subject={subject} />;
}
