import type { LogConfig } from "kysely";
import { describe, expect, it, vi, afterEach } from "vitest";
import { markSensitive } from "./SensitiveParam.js";
import { makeLogging } from "./makeLogging.js";

type QueryLogger = Exclude<LogConfig, readonly unknown[]>;

describe("makeLogging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns undefined by default", () => {
    expect(makeLogging()).toBeUndefined();
  });

  it("masks sensitive parameters when sensitive logging is disabled", () => {
    const log = makeLogging({
      enableLogging: true,
      enableSensitiveDataLogging: false,
    }) as QueryLogger;
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);

    log({
      level: "query",
      isStream: false,
      query: {
        query: {} as never,
        queryId: { queryId: "test" },
        sql: "SELECT 1",
        parameters: [markSensitive("secret"), "plain"],
      },
      queryDurationMillis: 5,
    });

    expect(consoleLog).toHaveBeenNthCalledWith(1, "SQL:", "SELECT 1");
    expect(consoleLog).toHaveBeenNthCalledWith(2, "Parameters: [[SENSITIVE], 'plain']");
    expect(consoleLog).toHaveBeenNthCalledWith(3, "Duration (ms):", 5);
  });

  it("uses a custom placeholder for sensitive parameters", () => {
    const log = makeLogging({
      enableLogging: true,
      enableSensitiveDataLogging: false,
      sensitivePlaceholder: "[REDACTED]",
    }) as QueryLogger;
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);

    log({
      level: "query",
      isStream: false,
      query: {
        query: {} as never,
        queryId: { queryId: "test" },
        sql: "SELECT 1",
        parameters: [markSensitive("secret"), "plain"],
      },
      queryDurationMillis: 5,
    });

    expect(consoleLog).toHaveBeenNthCalledWith(2, "Parameters: [[REDACTED], 'plain']");
  });

  it("formats non-string values using the same logging path", () => {
    const log = makeLogging({
      enableLogging: true,
      enableSensitiveDataLogging: false,
    }) as QueryLogger;
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);

    log({
      level: "query",
      isStream: false,
      query: {
        query: {} as never,
        queryId: { queryId: "test" },
        sql: "SELECT 1",
        parameters: [null, 123, false],
      },
      queryDurationMillis: 5,
    });

    expect(consoleLog).toHaveBeenNthCalledWith(2, "Parameters: [null, 123, false]");
  });

  it("reveals sensitive parameters only when explicitly enabled", () => {
    const log = makeLogging({
      enableLogging: true,
      enableSensitiveDataLogging: true,
    }) as QueryLogger;
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);

    log({
      level: "query",
      isStream: false,
      query: {
        query: {} as never,
        queryId: { queryId: "test" },
        sql: "SELECT 1",
        parameters: [markSensitive("secret")],
      },
      queryDurationMillis: 5,
    });

    expect(consoleLog).toHaveBeenNthCalledWith(2, "Parameters: [[SENSITIVE]'secret']");
  });

  it("uses the same placeholder prefix when sensitive values are revealed", () => {
    const log = makeLogging({
      enableLogging: true,
      enableSensitiveDataLogging: true,
      sensitivePlaceholder: "[REDACTED]",
    }) as QueryLogger;
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);

    log({
      level: "query",
      isStream: false,
      query: {
        query: {} as never,
        queryId: { queryId: "test" },
        sql: "SELECT 1",
        parameters: [markSensitive("secret")],
      },
      queryDurationMillis: 5,
    });

    expect(consoleLog).toHaveBeenNthCalledWith(2, "Parameters: [[REDACTED]'secret']");
  });

  it("logs errors through console.error", () => {
    const log = makeLogging({
      enableLogging: true,
    }) as QueryLogger;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("boom");

    log({
      level: "error",
      error,
      query: {
        query: {} as never,
        queryId: { queryId: "test" },
        sql: "SELECT 1",
        parameters: [],
      },
      queryDurationMillis: 5,
    });

    expect(consoleError).toHaveBeenCalledWith("Query failed:", error);
  });
});
