import type {
  AbortableOperationOptions,
  CompiledQuery,
  DatabaseConnection,
  Dialect,
  Driver,
  Kysely,
  QueryResult,
} from "kysely";
import { getSensitiveValue, isSensitive } from "./SensitiveParam.js";

function unwrapParameters(parameters: readonly unknown[]): unknown[] {
  return parameters.map((param) => {
    if (!isSensitive(param)) {
      return param;
    }

    return getSensitiveValue(param);
  });
}

const wrappedConnections = new WeakMap<object, DatabaseConnection>();
const wrappedDrivers = new WeakMap<object, Driver>();

function copyProperties(
  target: object,
  source: object,
  thisArg: object,
  override?: (key: PropertyKey, descriptor: PropertyDescriptor) => PropertyDescriptor | undefined,
): void {
  const seen = new Set<PropertyKey>();
  let current: object | null = source;

  while (current && current !== Object.prototype) {
    const keys = [
      ...Object.getOwnPropertyNames(current),
      ...Object.getOwnPropertySymbols(current),
    ] as PropertyKey[];

    for (const key of keys) {
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!descriptor) {
        continue;
      }

      const overrideDescriptor = override?.(key, descriptor);
      if (overrideDescriptor) {
        Object.defineProperty(target, key, overrideDescriptor);
        continue;
      }

      if (typeof descriptor.value === "function") {
        Object.defineProperty(target, key, {
          configurable: true,
          enumerable: descriptor.enumerable,
          writable: true,
          value: function (...args: unknown[]) {
            return descriptor.value.apply(thisArg, args);
          },
        });
        continue;
      }

      if (descriptor.get || descriptor.set) {
        Object.defineProperty(target, key, {
          configurable: true,
          enumerable: descriptor.enumerable,
          get: descriptor.get
            ? function () {
              return descriptor.get!.call(thisArg);
            }
            : undefined,
          set: descriptor.set
            ? function (value: unknown) {
              return descriptor.set!.call(thisArg, value);
            }
            : undefined,
        });
        continue;
      }

      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: descriptor.enumerable,
        writable: true,
        value: descriptor.value,
      });
    }

    current = Object.getPrototypeOf(current);
  }
}

function wrapConnection(connection: DatabaseConnection): DatabaseConnection {
  const existing = wrappedConnections.get(connection as object);
  if (existing) {
    return existing;
  }

  const wrappedConnection = Object.create(Object.getPrototypeOf(connection)) as DatabaseConnection;

  copyProperties(wrappedConnection, connection, connection, (key, descriptor) => {
    if (key === "executeQuery") {
      return {
        configurable: true,
        enumerable: descriptor.enumerable,
        writable: true,
        value: async <R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> =>
          connection.executeQuery<R>({
            ...compiledQuery,
            parameters: unwrapParameters(compiledQuery.parameters),
          }),
      };
    }

    if (key === "streamQuery") {
      return {
        configurable: true,
        enumerable: descriptor.enumerable,
        writable: true,
        value: <R>(
          compiledQuery: CompiledQuery,
          chunkSize: number,
          options?: AbortableOperationOptions,
        ) => connection.streamQuery<R>(compiledQuery, chunkSize, options),
      };
    }

    return undefined;
  });

  wrappedConnections.set(connection as object, wrappedConnection);
  wrappedConnections.set(wrappedConnection as object, wrappedConnection);
  return wrappedConnection;
}

function wrapDriver(driver: Driver): Driver {
  const existing = wrappedDrivers.get(driver as object);
  if (existing) {
    return existing;
  }

  const wrappedDriver = Object.create(Object.getPrototypeOf(driver)) as Driver;

  copyProperties(wrappedDriver, driver, driver, (key, descriptor) => {
    if (key === "acquireConnection") {
      return {
        configurable: true,
        enumerable: descriptor.enumerable,
        writable: true,
        value: async (options?: AbortableOperationOptions) => {
          const connection = await driver.acquireConnection(options);
          return wrapConnection(connection);
        },
      };
    }

    return undefined;
  });

  wrappedDrivers.set(driver as object, wrappedDriver);
  wrappedDrivers.set(wrappedDriver as object, wrappedDriver);
  return wrappedDriver;
}

/**
 * A Dialect wrapper that unwraps `SensitiveParam` values immediately before query execution.
 */
export class SensitiveUnwrappingDialect<TDialect extends Dialect> implements Dialect {
  readonly #dialect: TDialect;

  constructor(dialect: TDialect) {
    this.#dialect = dialect;
  }

  createAdapter() {
    return this.#dialect.createAdapter();
  }

  createIntrospector(db: Kysely<unknown>) {
    return this.#dialect.createIntrospector(db);
  }

  createQueryCompiler() {
    return this.#dialect.createQueryCompiler();
  }

  createDriver() {
    return wrapDriver(this.#dialect.createDriver());
  }
}
