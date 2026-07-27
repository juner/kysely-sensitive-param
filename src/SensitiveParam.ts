import type { Expression, ValueNode } from "kysely";

type SensitivePrimitive = string | number | boolean;
type SensitivePrimitiveArray = readonly string[] | readonly number[] | readonly boolean[];

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
  SensitivePrimitiveArray,
};

function isSensitivePrimitiveArray(value: SensitivePrimitive | SensitivePrimitiveArray): value is SensitivePrimitiveArray {
  return Array.isArray(value);
}

export function markSensitive<T extends SensitivePrimitive>(value: T): SensitiveParam<T>;
export function markSensitive<T extends SensitivePrimitiveArray>(value: T): ReadonlyArray<SensitiveParam<T[number]>>;
export function markSensitive(value: SensitivePrimitive | SensitivePrimitiveArray): SensitiveParam<SensitivePrimitive> | ReadonlyArray<SensitiveParam<SensitivePrimitive>> {
  if (isSensitivePrimitiveArray(value)) {
    return value.map(v => new SensitiveParam(v));
  }
  return new SensitiveParam(value);
}

export function isSensitive(param: unknown): param is SensitiveParam<SensitivePrimitive> {
  return param instanceof SensitiveParam;
}

export function getSensitiveValue<T extends SensitivePrimitive>(param: SensitiveParam<T>): T {
  return SensitiveParam.unwrap(param);
}
