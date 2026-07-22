import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE, fetchJson, postJson } from "./api";

describe("api network errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("converts fetch network failures into a friendly backend hint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );

    const backendHost = new URL(API_BASE, "http://localhost:3000").host;
    const expectedMessage = `无法连接后端服务（${backendHost}），请确认后端已启动`;
    await expect(fetchJson("/tasks")).rejects.toThrow(expectedMessage);
    await expect(postJson("/debug/sync")).rejects.toThrow(expectedMessage);
  });

  it("keeps http status errors unchanged", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500 }))
    );

    await expect(fetchJson("/tasks")).rejects.toThrow("Request failed: 500");
  });
});
