import { describe, expect, it } from "vitest";
import { getSensitiveValue, isSensitive, markSensitive } from "./SensitiveParam.js";

describe("SensitiveParam", () => {
  it("marks values as sensitive", () => {
    const value = markSensitive("secret");

    expect(isSensitive(value)).toBe(true);
    expect(isSensitive("secret")).toBe(false);
    expect(isSensitive({ value: "secret" })).toBe(false);
  });

  it("returns the original wrapped value", () => {
    expect(getSensitiveValue(markSensitive("secret"))).toBe("secret");
    expect(getSensitiveValue(markSensitive(42))).toBe(42);
    expect(getSensitiveValue(markSensitive(true))).toBe(true);
  });

  it("creates a Kysely value node containing the wrapper instance", () => {
    const value = markSensitive("secret");

    expect(value.expressionType).toBeUndefined();
    expect(value.toOperationNode()).toEqual({
      kind: "ValueNode",
      value,
    });
  });

  it("throws when attempting to unwrap a non-sensitive value", () => {
    expect(() => getSensitiveValue("secret" as never)).toThrow("Expected SensitiveParam instance");
  });
});
