<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Chronicle CLI effects at v3.53.1

Derived from `cratis llm-context` printed by **Cratis.Cli 3.53.1**. Use the
installed version's catalog, not this snapshot, for later releases. The tag's
[effect/confirmation contract](https://github.com/Cratis/cli/blob/v3.53.1/Documentation/reference/llm-context.md)
defines `read-only`, `local`, `mutating`, `destructive`; every other or unknown
effect is a state change. `requiresConfirmation=true` fails non-interactively
without `--yes`, independently of effect. Confirmation is not authorization.

All paths below start with `cratis chronicle`. This table exhausts its
non-read-only commands at that version.

| Path | Effect | requiresConfirmation |
| --- | --- | --- |
| `login` | local | false |
| `logout` | local | false |
| `workbench` | destructive | false (its actions have their own dialogs) |
| `applications add` | mutating | false |
| `applications remove` | destructive | true |
| `jobs resume` | mutating | true |
| `jobs stop` | mutating | true |
| `observers clear-partition-quarantine` | mutating | true |
| `observers clear-quarantine` | mutating | true |
| `observers remove` | destructive | true |
| `observers replay` | destructive | true |
| `observers replay-partition` | destructive | true |
| `observers retry-partition` | mutating | true |
| `recommendations ignore` | mutating | true |
| `recommendations perform` | destructive | true |
| `subscriptions add` | mutating | false |
| `subscriptions remove` | destructive | true |
| `users add` | mutating | false |
| `users remove` | destructive | true |

The remaining Chronicle commands are cataloged read-only, including
`report-error`; the guard deliberately blocks that command because it opens an
external browser issue form. `chronicle version` is not a command in this
catalog; server version is included in diagnostic output.

Critical effect implementations at the tag:

- [RemoveObserverCommand.cs:18–52](https://github.com/Cratis/cli/blob/v3.53.1/Source/Cli/Commands/Chronicle/Observers/RemoveObserverCommand.cs#L18-L52):
  deletes observer records across all namespaces, leaves read model data,
  refuses running/subscribed observers.
- [ClearPartitionQuarantineCommand.cs:20–53](https://github.com/Cratis/cli/blob/v3.53.1/Source/Cli/Commands/Chronicle/Observers/ClearPartitionQuarantineCommand.cs#L20-L53):
  Chronicle 19.29.0+, resets retry budget, retries unless `--no-retry`.
- [ChronicleCommand.cs](https://github.com/Cratis/cli/blob/v3.53.1/Source/Cli/Commands/Chronicle/ChronicleCommand.cs):
  confirmation handling shared by prompted commands.
- [WorkbenchCommand.cs](https://github.com/Cratis/cli/blob/v3.53.1/Source/Cli/Commands/Chronicle/Workbench/WorkbenchCommand.cs):
  destructive interactive surface, table output only.

The guard covers `chronicle` only. `direct login|logout|status|use` declares
`mutating` but is outside that guard's scope, as are other top-level groups.
Do not infer authorization from the absence of a guard.
