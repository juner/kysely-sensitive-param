# kysely-sensitive-param

[![npm version](https://img.shields.io/npm/v/kysely-sensitive-param)](https://www.npmjs.com/package/kysely-sensitive-param)
[![CI](https://github.com/juner/kysely-sensitive-param/actions/workflows/test.yml/badge.svg)](https://github.com/juner/kysely-sensitive-param/actions/workflows/test.yml)

`kysely-sensitive-param` is a small helper package for passing raw values to Kysely queries while making sensitive parameters safer to handle in logs.

## Installation

```bash
npm install kysely kysely-sensitive-param
```

## Features

- Mark sensitive values with `markSensitive(value)`
- Unwrap marked values immediately before query execution with `SensitiveUnwrappingDialect`
- Mask or explicitly reveal `SensitiveParam` values in logs with `makeLogging()`

## Usage

```ts
import { Kysely, PostgresDialect } from "kysely";
import { SensitiveUnwrappingDialect, makeLogging, markSensitive } from "kysely-sensitive-param";
import { Pool } from "pg";

const db = new Kysely({
  log: makeLogging({
    enableLogging: true,
    enableSensitiveDataLogging: false,
  }),
  dialect: new SensitiveUnwrappingDialect(
    new PostgresDialect({
      pool: new Pool({
        connectionString: "postgres://user:password@localhost:5432/app",
      }),
    }),
  ),
});

await db
  .selectFrom("users")
  .where("email", "=", "octocat@example.com")
  .where("password", "=", markSensitive("super-secret"))
  .executeTakeFirst();
```

## Logging behavior

`makeLogging()` is configured explicitly through options:

- `enableLogging: true`: enable query logging
- `enableSensitiveDataLogging: true`: reveal sensitive values in logs
- `sensitivePlaceholder: "[REDACTED]"`: customize the placeholder used when values stay masked
- omit both options, or leave `enableLogging` as `false`, to disable logging entirely

When query logging is enabled and sensitive value logging is disabled, `SensitiveParam` values are printed as `[SENSITIVE]`.

## Exports

```ts
import {
  getSensitiveValue,
  isSensitive,
  makeLogging,
  markSensitive,
  SensitiveUnwrappingDialect,
} from "kysely-sensitive-param";
```
