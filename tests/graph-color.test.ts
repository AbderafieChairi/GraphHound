import { expect, test } from "bun:test";
import { oklchToRgba } from "../src/lib/graph-color";

test("converts oklch to rgba", () => {
  expect(oklchToRgba("oklch(1 0 0)")).toBe("rgba(255, 255, 255, 1)");
  expect(oklchToRgba("oklch(0 0 0 / 50%)")).toBe("rgba(0, 0, 0, 0.5)");
  expect(oklchToRgba("#fff")).toBeNull();
});
