export const SUBJECTS = [
  { slug: "ring", name: "링" },
  { slug: "wrecking-ball", name: "레킹볼" },
  { slug: "heavy-bags", name: "샌드백" },
  { slug: "wall-clock", name: "벽시계" },
] as const;

export type Subject = (typeof SUBJECTS)[number]["slug"];

export function subjectOf(slug: string): Subject | undefined {
  return SUBJECTS.find((subject) => subject.slug === slug)?.slug;
}
