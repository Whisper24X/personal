import { assertValidTransition } from "./state-machine";

describe("state machine", () => {
  it("accepts legal task lifecycle transitions", () => {
    expect(() => assertValidTransition("draft", "ready")).not.toThrow();
    expect(() => assertValidTransition("draft", "waiting")).not.toThrow();
    expect(() => assertValidTransition("ready", "active")).not.toThrow();
    expect(() => assertValidTransition("active", "succeeded")).not.toThrow();
    expect(() => assertValidTransition("active", "waiting")).not.toThrow();
    expect(() => assertValidTransition("active", "failed")).not.toThrow();
    expect(() => assertValidTransition("active", "ready")).not.toThrow();
    expect(() => assertValidTransition("waiting", "ready")).not.toThrow();
    expect(() => assertValidTransition("failed", "ready")).not.toThrow();
    expect(() => assertValidTransition("cancelled", "draft")).not.toThrow();
    expect(() => assertValidTransition("cancelled", "ready")).not.toThrow();
  });

  it("rejects execution stages as task statuses", () => {
    expect(() => assertValidTransition("ready", "evaluating" as never)).toThrow("Illegal task transition");
    expect(() => assertValidTransition("active", "repairing" as never)).toThrow("Illegal task transition");
  });

  it("keeps succeeded terminal", () => {
    expect(() => assertValidTransition("succeeded", "ready")).toThrow("Illegal task transition");
  });
});
