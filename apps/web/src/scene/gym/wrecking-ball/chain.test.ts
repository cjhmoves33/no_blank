import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { LINK_PITCH, linkCount, type LinkPose, linksAlong } from "./chain";

const TOP = new Vector3(0, 0, 0);
const BOTTOM = new Vector3(0, -0.75, 0);
const UP = new Vector3(0, 1, 0);
const RING_NORMAL = new Vector3(0, 0, 1);

function straight(t: number): Vector3 {
  return TOP.clone().lerp(BOTTOM, t);
}

function sagging(t: number): Vector3 {
  return straight(t).add(new Vector3(0.2 * 4 * t * (1 - t), 0, 0));
}

function gaps(links: readonly LinkPose[]): number[] {
  return links
    .slice(1)
    .map((link, i) => link.position.distanceTo(links[i]?.position ?? TOP));
}

function longAxis(link: LinkPose): Vector3 {
  return UP.clone().applyQuaternion(link.quaternion);
}

describe("사슬 고리", () => {
  it("곧은 사슬은 양 끝 사이를 고리 간격대로 빈틈 없이 잇는다", () => {
    const links = linksAlong(straight, linkCount(0.75));
    const first = links.at(0);
    const last = links.at(-1);

    if (!first || !last) {
      throw new Error("고리가 있어야 합니다.");
    }

    expect(first.position.distanceTo(TOP)).toBeLessThan(LINK_PITCH * 0.55);
    expect(last.position.distanceTo(BOTTOM)).toBeLessThan(LINK_PITCH * 0.55);

    for (const gap of gaps(links)) {
      expect(gap).toBeGreaterThan(LINK_PITCH * 0.95);
      expect(gap).toBeLessThan(LINK_PITCH * 1.05);
    }
  });

  it("고리는 사슬을 따라 길게 놓이고, 하나 걸러 90도 돌아 있다", () => {
    const links = linksAlong(straight, linkCount(0.75));

    links.forEach((link, i) => {
      expect(Math.abs(longAxis(link).dot(UP))).toBeCloseTo(1, 6);

      const next = links[i + 1];

      if (next) {
        const facing = RING_NORMAL.clone().applyQuaternion(link.quaternion);
        const nextFacing = RING_NORMAL.clone().applyQuaternion(next.quaternion);

        expect(facing.dot(nextFacing)).toBeCloseTo(0, 6);
      }
    });
  });

  it("느슨해서 휜 사슬도 고리 사이가 고르고, 고리는 휜 길을 따라 놓인다", () => {
    const links = linksAlong(sagging, linkCount(0.75));
    const spacing = gaps(links);
    const average = spacing.reduce((sum, gap) => sum + gap, 0) / spacing.length;

    for (const gap of spacing) {
      expect(Math.abs(gap - average)).toBeLessThan(average * 0.05);
    }

    links.slice(1, -1).forEach((link, i) => {
      const before = links[i]?.position ?? TOP;
      const after = links[i + 2]?.position ?? BOTTOM;
      const along = after.clone().sub(before).normalize();

      expect(Math.abs(longAxis(link).dot(along))).toBeGreaterThan(0.99);
    });
  });
});
