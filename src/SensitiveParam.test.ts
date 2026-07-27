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
    expect(getSensitiveValue(markSensitive(null))).toBeNull();
  });

  it("marks array values as sensitive and preserves each original value", () => {
    const values = markSensitive(["secret", "public"] as const);

    expect(values).toHaveLength(2);
    expect(values.every(v => isSensitive(v))).toBe(true);
    expect(values.map(v => getSensitiveValue(v))).toEqual(["secret", "public"]);
  });

  it("marks numeric arrays as sensitive and preserves order", () => {
    const values = markSensitive([3, 1, 4]);

    expect(values).toHaveLength(3);
    expect(values.every(v => isSensitive(v))).toBe(true);
    expect(values.map(v => getSensitiveValue(v))).toEqual([3, 1, 4]);
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
