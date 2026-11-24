import { describe, expect, it } from "vitest";

import { clearOf } from "./brushes";

describe("clearOf", () => {
  it("같은 색을 알파 0 으로 돌려줍니다", () => {
    expect(clearOf("rgba(255, 250, 240, 0.08)")).toBe("rgba(255, 250, 240, 0)");
    expect(clearOf("rgba(20, 10, 0, 0.1)")).toBe("rgba(20, 10, 0, 0)");
  });

  it("rgba() 가 아닌 색은 받지 않습니다", () => {
    expect(() => clearOf("#ffffff")).toThrow();
  });
});
