import { describe, expect, it } from "vitest";
import { resolveInitialTheme } from "./theme";

describe("resolveInitialTheme", () => {
  it("prefers the stored theme over system preference", () => {
    expect(resolveInitialTheme("dark", false)).toBe("dark");
    expect(resolveInitialTheme("light", true)).toBe("light");
  });

  it("falls back to system preference when nothing is stored", () => {
    expect(resolveInitialTheme(null, true)).toBe("dark");
    expect(resolveInitialTheme(null, false)).toBe("light");
  });

  it("ignores invalid stored values", () => {
    expect(resolveInitialTheme("blue", true)).toBe("dark");
    expect(resolveInitialTheme("blue", false)).toBe("light");
  });
});
