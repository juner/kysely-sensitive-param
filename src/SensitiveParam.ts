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

/**
 * Wraps a sensitive primitive so it can be passed through Kysely as a query parameter.
 *
 * @param value The primitive value to wrap.
 * @returns A wrapper that preserves the original value until query execution.
 */
export function markSensitive<T extends SensitivePrimitive>(value: T): SensitiveParam<T>;

/**
 * Wraps an array of sensitive primitives so it can be passed through Kysely as query parameters.
 *
 * @param value The array of primitive values to wrap.
 * @returns A readonly array of wrappers that preserves each original value until query execution.
 */
export function markSensitive<T extends SensitivePrimitiveArray>(value: T): ReadonlyArray<SensitiveParam<T[number]>>;

/**
 * Wraps a sensitive primitive or array of primitives so it can be passed through Kysely as a query parameter.
 *
 * @param value The value to wrap.
 * @returns A wrapper or array of wrappers that preserves the original value until query execution.
 */
export function markSensitive(value: SensitivePrimitive | SensitivePrimitiveArray): SensitiveParam<SensitivePrimitive> | ReadonlyArray<SensitiveParam<SensitivePrimitive>> {
  if (isSensitivePrimitiveArray(value)) {
    return value.map(v => new SensitiveParam(v));
  }
  return new SensitiveParam(value);
}

/**
 * Checks whether a value was wrapped with markSensitive.
 *
 * @param param The value to inspect.
 * @returns True when the value is a SensitiveParam instance.
 */
export function isSensitive(param: unknown): param is SensitiveParam<SensitivePrimitive> {
  return param instanceof SensitiveParam;
}

/**
 * Returns the original primitive value from a SensitiveParam wrapper.
 *
 * @param param The wrapped sensitive value.
 * @returns The unwrapped primitive value.
 */
export function getSensitiveValue<T extends SensitivePrimitive>(param: SensitiveParam<T>): T {
  return SensitiveParam.unwrap(param);
}
