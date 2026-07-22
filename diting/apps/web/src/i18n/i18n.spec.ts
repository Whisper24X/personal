import { describe, expect, it } from "vitest";
import { resolveInitialLocale, translate } from "./index";
import { en, type MessageKey } from "./en";
import { zh } from "./zh";

describe("resolveInitialLocale", () => {
  it("prefers the stored locale over browser language", () => {
    expect(resolveInitialLocale("zh", "en-US")).toBe("zh");
    expect(resolveInitialLocale("en", "zh-CN")).toBe("en");
  });

  it("falls back to browser language when nothing is stored", () => {
    expect(resolveInitialLocale(null, "zh-CN")).toBe("zh");
    expect(resolveInitialLocale(null, "zh-TW")).toBe("zh");
    expect(resolveInitialLocale(null, "en-US")).toBe("en");
    expect(resolveInitialLocale(null, "ja-JP")).toBe("en");
  });

  it("defaults to english when stored value is invalid and language is unknown", () => {
    expect(resolveInitialLocale("fr", undefined)).toBe("en");
    expect(resolveInitialLocale(null, undefined)).toBe("en");
  });
});

describe("translate", () => {
  it("returns localized messages for both languages", () => {
    expect(translate("en", "actions.refresh")).toBe("Refresh");
    expect(translate("zh", "actions.refresh")).toBe("刷新");
  });

  it("interpolates named parameters", () => {
    expect(translate("en", "common.attempt", { attempt: 1, limit: 2 })).toBe("attempt 1/2");
    expect(translate("zh", "stats.healthy", { count: 3 })).toBe("3 个健康");
  });

  it("keeps unmatched placeholders untouched", () => {
    expect(translate("en", "runs.run", {})).toBe("Run {id}");
  });
});

describe("dictionaries", () => {
  it("covers every english key with a chinese translation", () => {
    const missing = (Object.keys(en) as MessageKey[]).filter((key) => zh[key] === undefined || zh[key] === "");
    expect(missing).toEqual([]);
  });
});
