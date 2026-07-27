import type { ErrorLogEvent, LogConfig, QueryLogEvent } from "kysely";
import { getSensitiveValue, isSensitive } from "./SensitiveParam.js";

type MakeLoggingOptions = {
  /**
   * Whether to reveal SensitiveParam values in logs.
   * @default false
   */
  enableSensitiveDataLogging?: boolean
  /**
   * Whether to emit query logs.
   * @default false
   */
  enableLogging?: boolean
  /**
   * The placeholder to print when sensitive value logging is disabled.
   * @default "[SENSITIVE]"
   */
  sensitivePlaceholder?: string
};

function toLiteral(param: unknown): string {
  if (typeof param === "string") {
    return `'${param}'`;
  }

  if (param === null) {
    return "null";
  }

  return `${param}`;
}

function formatParameter(
  param: unknown,
  enableSensitiveDataLogging: boolean,
  sensitivePlaceholder: string,
): string {
  if (!isSensitive(param)) {
    return toLiteral(param);
  }

  if (!enableSensitiveDataLogging) {
    return sensitivePlaceholder;
  }

  return `${sensitivePlaceholder}${toLiteral(getSensitiveValue(param))}`;
}

/**
 * Creates a Kysely logging handler that can redact sensitive parameters.
 *
 * @param options Configuration for whether to log queries, whether to reveal sensitive values,
 * and the placeholder used when sensitive values are hidden.
 * @returns A logging callback for Kysely, or undefined when logging is disabled.
 */
export function makeLogging(options?: MakeLoggingOptions): LogConfig | undefined {
  const resolvedOptions = {
    enableSensitiveDataLogging: false,
    enableLogging: false,
    sensitivePlaceholder: "[SENSITIVE]",
    ...options,
  };
  const { enableSensitiveDataLogging, enableLogging, sensitivePlaceholder } = resolvedOptions;

  if (!enableLogging) {
    return undefined;
  }

  const queryLogging = (event: QueryLogEvent): void => {
    console.log("SQL:", event.query.sql);
    console.log(
      `Parameters: [${event.query.parameters
        .map(param => formatParameter(param, enableSensitiveDataLogging, sensitivePlaceholder))
        .join(", ")}]`,
    );
    console.log("Duration (ms):", event.queryDurationMillis);
  };

  const errorLogging = (event: ErrorLogEvent): void => {
    console.error("Query failed:", event.error);
  };

  return (event) => {
    if (event.level === "query") {
      queryLogging(event);
    }

    if (event.level === "error") {
      errorLogging(event);
    }
  };
}

export type { MakeLoggingOptions };
