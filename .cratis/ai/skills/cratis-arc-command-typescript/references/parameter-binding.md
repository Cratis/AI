# Binding command parameters

This reference holds how Arc learns `handle()` and `provide()` parameter types and the built-in `@inject(...)` markers.

## Bind parameters

TypeScript erases parameter types, so Arc learns them one of two ways:

- **Generated artifact metadata** (the samples): `arc-proxygenerator --metadata`
  writes a module from source; `handle(tasks: Tasks)` then needs no decorator.
- **Explicit tokens**: `@inject(Tasks)` on `handle()` or `provide()`, one token
  or marker per parameter, in order.

Built-in markers for `@inject(...)`:

| Marker | Binds |
| --- | --- |
| `abortSignal()` | The request's `AbortSignal` — pass it to cancelable I/O |
| `commandContext()` | The `CommandContext`: `key`, `values`, `correlationId`, `principal`, `tenantId`, `signal` |
| `provided(Type)` | A value from `provide()`, matched by runtime type |
| `commandReadModel(Type, { optional? })` | The read model for the command key, from a registered resolver (MongoDB, Drizzle, Chronicle) |
| `mongoCollection(Model)` / `drizzleDatabase()` | Storage handles from the optional integrations |

`build()` fails with `Unbound handle parameters on <Type>.handle` when neither
metadata nor tokens cover a parameter. Default and rest parameters always need
explicit tokens.
