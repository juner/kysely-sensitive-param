import type { Expression, ValueNode } from "kysely";

type SensitivePrimitive = string | number | boolean;

/**
 * Wraps a sensitive primitive so it can be passed through Kysely as a query parameter.
 */
class SensitiveParam<T extends SensitivePrimitive> implements Expression<T> {
  #value: T;

  constructor(value: T) {
    this.#value = value;
  }

  get expressionType(): T | undefined {
    return undefined;
  }

  toOperationNode(): ValueNode {
    return {
      kind: "ValueNode",
      value: this,
    };
  }

  static unwrap<T extends SensitivePrimitive>(param: SensitiveParam<T>): T {
    if (!(param instanceof SensitiveParam)) {
      throw new Error("Expected SensitiveParam instance");
    }

    return param.#value;
  }
}

export type {
  SensitiveParam,
  SensitivePrimitive,
};

export function markSensitive<T extends SensitivePrimitive>(value: T): SensitiveParam<T> {
  return new SensitiveParam(value);
}

export function isSensitive(param: unknown): param is SensitiveParam<SensitivePrimitive> {
  return param instanceof SensitiveParam;
}

export function getSensitiveValue<T extends SensitivePrimitive>(param: SensitiveParam<T>): T {
  return SensitiveParam.unwrap(param);
}
