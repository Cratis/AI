# The `cratis` CLI

A terminal window into a running Chronicle event store. Everything below was verified against the
`Cratis/cli` repository — the command names and examples come from the `[CliCommand]` and
`[CliExample]` declarations on the command classes, and the option flags from their settings types.

The CLI talks to a **running server**. It reads no source code and knows nothing about your slices
beyond what the store has registered.

## Install

| Method | Command |
|---|---|
| Homebrew (macOS, Linux) | `brew tap cratis/cratis && brew install cratis` |
| .NET global tool (any platform, .NET 10+) | `dotnet tool install -g Cratis.Cli` |
| Native binary | Download `cratis-<version>-<rid>.tar.gz` from the releases for `osx-arm64`, `osx-x64`, `linux-arm64`, `linux-x64` |
| Shell completions | `cratis completions install` — detects bash, zsh, fish, or PowerShell |

Native binaries are self-contained and need no .NET installed. There is no native Windows binary;
Windows goes through the global tool.

Completions are not a static word list — completing an observer, event store, event type,
projection, read model, job, recommendation, subscription, application, or user name shells back
into the CLI, which asks the live server. A server that is down costs a tab press, not a broken
shell.

## Connecting

The connection string resolves in a fixed order, first match winning:

| | Source |
|---|---|
| 1 | `--server` on the command |
| 2 | `CHRONICLE_CONNECTION_STRING` |
| 3 | the active context in the CLI config (`cratis context path` prints its location) |
| 4 | `chronicle://localhost:35000` |

Credentials are composed in separately. If the winning connection string already carries
authentication — embedded `user:pass@` or an `apiKey=` parameter — it is used as given. Otherwise
the CLI composes in, in order: a cached token from `cratis chronicle login`, then the context's
client id and secret, then Chronicle's well-known development credentials. That last fallback is
why a local Chronicle needs nothing configured. Connection strings are redacted to `user:***@host`
wherever the CLI prints them.

```bash
cratis context create dev --server chronicle://localhost:35000
cratis context set dev
cratis context list
cratis context show
cratis context set-value event-store <name>
cratis get-started              # setup status, connection health, starter commands
```

`-e/--event-store` and `-n/--namespace` follow the same shape, falling back to the context and
then to the defaults. The first `chronicle` command against a server whose event store is unknown
asks which one to use and remembers the answer.

## Command surface

### Health

```bash
cratis chronicle diagnose                     # whole-server verdict; non-zero exit when unhealthy
cratis chronicle diagnose --watch             # the same report, refreshing
cratis chronicle diagnose --watch --interval 2
cratis chronicle workbench                    # full-screen live dashboard
```

### Stores, namespaces, events

```bash
cratis chronicle event-stores list
cratis chronicle namespaces list
cratis chronicle events get --from 100 --to 200
cratis chronicle events get --event-type UserRegistered
cratis chronicle events get --event-source-id <id>
cratis chronicle events tail                  # highest sequence number in use
cratis chronicle event-types list             # registered types, with generations
cratis chronicle event-types show <id>        # the JSON Schema for one
```

`events get` also takes `--sequence <ID>` to target an event sequence other than the default event
log.

### Observers and failures

```bash
cratis chronicle observers list
cratis chronicle observers list --type reactor        # reactor | reducer | projection | all
cratis chronicle observers show <observer-id>
cratis chronicle observers replay <observer-id>
cratis chronicle observers replay-partition <observer-id> <partition>
cratis chronicle observers retry-partition <observer-id> <partition>
cratis chronicle observers clear-quarantine <observer-id>
cratis chronicle failed-partitions list
cratis chronicle failed-partitions list --observer <observer-id>
cratis chronicle failed-partitions show <observer-id> <partition>
```

### Projections, read models, jobs

```bash
cratis chronicle projections list
cratis chronicle projections show <name>
cratis chronicle read-models list
cratis chronicle read-models instances <name>              # --page, --page-size
cratis chronicle read-models get <name> <key>
cratis chronicle read-models snapshots <name> <key>
cratis chronicle read-models occurrences <name>
cratis chronicle jobs list                                 # replays, migrations, retries
cratis chronicle jobs get <id>
cratis chronicle jobs stop <id>
cratis chronicle jobs resume <id>
cratis chronicle recommendations list
cratis chronicle recommendations perform <id>
cratis chronicle recommendations ignore <id>
```

### Administration

```bash
cratis chronicle login <user>            # --secret
cratis chronicle logout
cratis chronicle auth status
cratis chronicle applications list|add|remove
cratis chronicle users list|add|remove
cratis chronicle identities list
cratis chronicle subscriptions list|add|remove
cratis chronicle report-error            # --title
```

`--help` works on every group and every command. `cratis llm-context` prints the whole surface as
JSON for tooling.

## Output formats

Global options, available on every command:

| Option | Effect |
|---|---|
| `-o, --output` | `table`, `plain`, `json`, or `json-compact` |
| `-q, --quiet` | identifiers only — built for piping |
| `-y, --yes` | skip confirmation prompts |
| `--debug` | verbose diagnostics |

**The default is chosen from the surroundings**, not fixed: a terminal gets `table`, redirected
output gets `json`, `NO_COLOR` gets `plain`, and a detected agent environment gets `json-compact`
with the banner and update notice suppressed. `CRATIS_NO_UPDATE_CHECK=1` turns off the update check
everywhere else.

Prefer `-o plain` for large result sets — it is tab-separated and several times smaller than JSON,
which repeats every field name on every row. The gap is widest on `events get`. Prefer
`-o json`/`json-compact` when you need nesting or are parsing the result.

`-q` exists to be piped:

```bash
cratis chronicle observers list -q | xargs -I {} cratis chronicle observers replay {} -y
```

## The workbench

`cratis chronicle workbench` opens a full-screen dashboard over the same connection, refreshing on
an interval, with actions in place.

| Key | |
|---|---|
| `F` | filter the current view |
| `Ctrl+P` | search every artifact kind at once |
| `R` | replay the selected observer |
| `T` / `P` | retry / replay the selected failed partition |
| `S` / `U` | stop / resume the selected job |
| `A` / `I` | apply / ignore the selected recommendation |
| `D` / `V` | event type definition / the observers that read it |
| `Ctrl+E` / `Ctrl+N` | switch event store / namespace |
| `?` / `Q` | help / quit |

`Ctrl+P` is the one worth knowing: it matches across observers, projections, event types, read
models, and reactors simultaneously, because following a concept through a system means crossing
all of them.

## Beyond Chronicle

```bash
cratis arc commands list --url http://localhost:5000     # command endpoints an Arc app registered
cratis arc queries list                                  # query endpoints
```

The `arc` group talks HTTP to a running Arc application rather than gRPC to Chronicle, so `--url`
and `ARC_URL` apply instead of `--server`. Useful for confirming that the routes an application
actually mapped match the ones the generated proxies call.

The CLI also carries `prologue`, `run`, `render`, `screenplay`, `llm`, and `init` groups. Those
belong to the Screenplay and factory tooling, not to debugging a live store — see
`cratis-software-factory`.

## Teaching a project's AI tools about the store

```bash
cratis init            # writes a Chronicle reference file and wires up the AI tools a project uses
cratis llm-context     # the whole command surface as JSON
```

`init` detects which tools a project already uses rather than assuming. Treat the file it writes as
generated: refresh it with `cratis init --refresh` rather than editing it.
