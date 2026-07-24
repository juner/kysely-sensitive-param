import type {
  AbortableOperationOptions,
  CompiledQuery,
  DatabaseConnection,
  Dialect,
  DialectAdapter,
  DatabaseIntrospector,
  Driver,
  Kysely,
  QueryCompiler,
  QueryResult,
} from "kysely";
import { describe, expect, it, vi } from "vitest";
import { markSensitive } from "./SensitiveParam.js";
import { SensitiveUnwrappingDialect } from "./SensitiveUnwrapDialect.js";

const privateDriverMethodSymbol = Symbol("privateDriverMethod");
const privateConnectionMethodSymbol = Symbol("privateConnectionMethod");

class FakeConnection {
  staticLabel = "connection-label";
  #tag = "initial-tag";

  executeQuery = vi.fn(
    async <R>(
      _compiledQuery: CompiledQuery,
      _options?: AbortableOperationOptions,
    ): Promise<QueryResult<R>> =>
      ({
        insertId: undefined,
        numAffectedRows: 0n,
        rows: [] as R[],
      }) as QueryResult<R>,
  ) as unknown as DatabaseConnection["executeQuery"];

  streamQuery = vi.fn() as unknown as DatabaseConnection["streamQuery"];
  cancelQuery = vi.fn() as unknown as DatabaseConnection["cancelQuery"];
  collectSessionInfo = vi.fn() as unknown as DatabaseConnection["collectSessionInfo"];
  killSession = vi.fn() as unknown as DatabaseConnection["killSession"];
  [privateConnectionMethodSymbol] = vi.fn(async () => undefined);

  get tag() {
    return this.#tag;
  }

  set tag(value: string) {
    this.#tag = value;
  }
}

class FakeDriver implements Driver {
  init = vi.fn(async (_options?: AbortableOperationOptions) => undefined);
  destroy = vi.fn(async (_options?: AbortableOperationOptions) => undefined);
  acquireConnection = vi.fn(
    async (_options?: AbortableOperationOptions) => new FakeConnection() as DatabaseConnection,
  );

  beginTransaction = vi.fn(async () => undefined);
  commitTransaction = vi.fn(async () => undefined);
  rollbackTransaction = vi.fn(async () => undefined);
  releaseConnection = vi.fn(async () => undefined);
  customMethod = vi.fn();
  [privateDriverMethodSymbol] = vi.fn();
}

class FakeDriverWithPrototypeMethod implements Driver {
  #config: { value: string };

  constructor(config: { value: string }) {
    this.#config = config;
  }

  async init(_options?: AbortableOperationOptions) {
    void this.#config.value;
  }

  async destroy(_options?: AbortableOperationOptions) {
    return undefined;
  }

  async acquireConnection(_options?: AbortableOperationOptions) {
    return new FakeConnection() as DatabaseConnection;
  }

  async beginTransaction(
    _connection: DatabaseConnection,
    _settings: Driver["beginTransaction"] extends (...args: infer TArgs) => unknown ? TArgs[1] : never,
  ) {
    return undefined;
  }

  async commitTransaction(_connection: DatabaseConnection) {
    return undefined;
  }

  async rollbackTransaction(_connection: DatabaseConnection) {
    return undefined;
  }

  async releaseConnection(_connection: DatabaseConnection, _options?: AbortableOperationOptions) {
    return undefined;
  }
}

function createDialect(driver: Driver): Dialect {
  const adapter = {} as DialectAdapter;
  const introspector = {} as DatabaseIntrospector;
  const queryCompiler = {} as QueryCompiler;

  return {
    createAdapter() {
      return adapter;
    },
    createDriver() {
      return driver;
    },
    createIntrospector() {
      return introspector;
    },
    createQueryCompiler() {
      return queryCompiler;
    },
  };
}

describe("SensitiveUnwrappingDialect", () => {
  it("forwards arbitrary driver methods", () => {
    const driver = new FakeDriver();
    const wrappedDriver = new SensitiveUnwrappingDialect(createDialect(driver)).createDriver();

    (wrappedDriver as unknown as { customMethod: () => void }).customMethod();

    expect(driver.customMethod).toHaveBeenCalledTimes(1);
  });

  it("preserves prototype methods that depend on private fields", async () => {
    const driver = new FakeDriverWithPrototypeMethod({ value: "ok" });
    const wrappedDriver = new SensitiveUnwrappingDialect(createDialect(driver)).createDriver();

    await expect(wrappedDriver.init()).resolves.toBeUndefined();
  });

  it("unwraps sensitive parameters before executeQuery", async () => {
    const connection = new FakeConnection();
    const driver = new FakeDriver();
    driver.acquireConnection = vi.fn(async () => connection as DatabaseConnection);

    const wrappedDriver = new SensitiveUnwrappingDialect(createDialect(driver)).createDriver();
    const wrappedConnection = await wrappedDriver.acquireConnection();

    await wrappedConnection.executeQuery({
      query: {} as CompiledQuery["query"],
      queryId: { queryId: "test" },
      sql: "SELECT 1",
      parameters: [markSensitive("secret")],
    } as CompiledQuery);

    expect(connection.executeQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        parameters: ["secret"],
      }),
    );
  });

  it("preserves non-sensitive parameters and forwards acquire options", async () => {
    const connection = new FakeConnection();
    const driver = new FakeDriver();
    const signal = new AbortController().signal;
    driver.acquireConnection = vi.fn(async () => connection as DatabaseConnection);

    const wrappedDriver = new SensitiveUnwrappingDialect(createDialect(driver)).createDriver();
    const wrappedConnection = await wrappedDriver.acquireConnection({ signal });

    await wrappedConnection.executeQuery({
      query: {} as CompiledQuery["query"],
      queryId: { queryId: "test" },
      sql: "SELECT 1",
      parameters: ["plain", markSensitive("secret"), 123],
    } as CompiledQuery);

    expect(driver.acquireConnection).toHaveBeenCalledWith({ signal });
    expect(connection.executeQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        parameters: ["plain", "secret", 123],
      }),
    );
  });

  it("forwards stream queries without changing arguments", async () => {
    const connection = new FakeConnection();
    const driver = new FakeDriver();
    const signal = new AbortController().signal;
    driver.acquireConnection = vi.fn(async () => connection as DatabaseConnection);

    const wrappedDriver = new SensitiveUnwrappingDialect(createDialect(driver)).createDriver();
    const wrappedConnection = await wrappedDriver.acquireConnection();
    const compiledQuery = {
      query: {} as CompiledQuery["query"],
      queryId: { queryId: "test" },
      sql: "SELECT 1",
      parameters: [markSensitive("secret")],
    } as CompiledQuery;

    wrappedConnection.streamQuery(compiledQuery, 10, { signal });

    expect(connection.streamQuery).toHaveBeenCalledWith(compiledQuery, 10, { signal });
  });

  it("copies plain value properties from wrapped connections", async () => {
    const connection = new FakeConnection();
    const driver = new FakeDriver();
    driver.acquireConnection = vi.fn(async () => connection as DatabaseConnection);

    const wrappedDriver = new SensitiveUnwrappingDialect(createDialect(driver)).createDriver();
    const wrappedConnection = await wrappedDriver.acquireConnection();

    expect((wrappedConnection as unknown as { staticLabel: string }).staticLabel).toBe("connection-label");
  });

  it("binds accessor properties to the original connection", async () => {
    const connection = new FakeConnection();
    const driver = new FakeDriver();
    driver.acquireConnection = vi.fn(async () => connection as DatabaseConnection);

    const wrappedDriver = new SensitiveUnwrappingDialect(createDialect(driver)).createDriver();
    const wrappedConnection = await wrappedDriver.acquireConnection();
    const wrappedConnectionWithAccessor = wrappedConnection as unknown as { tag: string };

    expect(wrappedConnectionWithAccessor.tag).toBe("initial-tag");

    wrappedConnectionWithAccessor.tag = "updated-tag";

    expect(connection.tag).toBe("updated-tag");
    expect(wrappedConnectionWithAccessor.tag).toBe("updated-tag");
  });

  it("forwards symbol-based methods", async () => {
    const connection = new FakeConnection();
    const driver = new FakeDriver();
    driver.acquireConnection = vi.fn(async () => connection as DatabaseConnection);

    const wrappedDriver = new SensitiveUnwrappingDialect(createDialect(driver)).createDriver();
    const wrappedConnection = await wrappedDriver.acquireConnection();

    const wrappedDriverAsRecord = wrappedDriver as unknown as Record<PropertyKey, unknown>;
    const wrappedConnectionAsRecord = wrappedConnection as unknown as Record<PropertyKey, unknown>;

    (wrappedDriverAsRecord[privateDriverMethodSymbol] as () => void)();
    await (wrappedConnectionAsRecord[privateConnectionMethodSymbol] as () => Promise<void>)();

    expect(driver[privateDriverMethodSymbol]).toHaveBeenCalledTimes(1);
    expect(connection[privateConnectionMethodSymbol]).toHaveBeenCalledTimes(1);
  });

  it("leaves standard symbols untouched", () => {
    const driver = new FakeDriver();
    const wrappedDriver = new SensitiveUnwrappingDialect(createDialect(driver)).createDriver();

    const wrappedDriverAsRecord = wrappedDriver as unknown as Record<PropertyKey, unknown>;

    expect(wrappedDriverAsRecord[Symbol.toStringTag]).toBeUndefined();
    expect(Object.prototype.toString.call(wrappedDriver)).toBe("[object Object]");
  });

  it("delegates adapter, introspector, and query compiler creation", () => {
    const driver = new FakeDriver();
    const dialect = createDialect(driver);
    const wrappedDialect = new SensitiveUnwrappingDialect(dialect);
    const db = {} as Kysely<unknown>;

    expect(wrappedDialect.createAdapter()).toBe(dialect.createAdapter());
    expect(wrappedDialect.createIntrospector(db)).toBe(dialect.createIntrospector(db));
    expect(wrappedDialect.createQueryCompiler()).toBe(dialect.createQueryCompiler());
  });

  it("reuses wrapped connections", async () => {
    const connection = new FakeConnection();
    const driver = new FakeDriver();
    driver.acquireConnection = vi.fn(async () => connection as DatabaseConnection);

    const wrappedDriver = new SensitiveUnwrappingDialect(createDialect(driver)).createDriver();

    const first = await wrappedDriver.acquireConnection();
    const second = await wrappedDriver.acquireConnection();

    expect(first).toBe(second);
  });

  it("reuses wrapped drivers for the same driver instance", () => {
    const driver = new FakeDriver();
    const dialect = createDialect(driver);
    const wrappedDialect = new SensitiveUnwrappingDialect(dialect);

    expect(wrappedDialect.createDriver()).toBe(wrappedDialect.createDriver());
  });
});
