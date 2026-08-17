# Product and repository boundaries

## Ownership

<!-- markdownlint-disable MD013 -->

| Owner                            | Owns                                                                                                              | Does not own                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| AI                               | Factory contracts, workflows, profiles, policies, harness adapters, Planner orchestration, knowledge, evaluations | Framework/compiler semantics              |
| CLI                              | Deterministic commands, argument/output contracts, exit codes, confirmation, `llm-context`                        | Agent sessions, providers, workflow state |
| Studio                           | Collaborative intent/model, proposals, human review, project policy UX                                            | Containers and phase execution            |
| Screenplay                       | Language, AST, compiler, diagnostics, printer/language service                                                    | SDLC orchestration                        |
| Stage                            | Deterministic model execution and rendering                                                                       | Agent reasoning                           |
| Chronicle.Mcp                    | Portable Chronicle tool exposure                                                                                  | Factory authorization                     |
| Prompter                         | Grounded retrieval and evaluation methods                                                                         | Coding orchestration                      |
| Arc/Chronicle/Components/clients | APIs, analyzers, samples, capability metadata                                                                     | Copied factory runtime                    |

<!-- markdownlint-enable MD013 -->

Application repositories contain only project context and an optional
`.cratis/factory.json` pin/override manifest. Never stamp the runtime, prompts,
or orchestration engine into every application.

## CLI rules

Discover the live capability descriptor with:

```shell
cratis llm-context -o json-compact
cratis llm-context --schema
cratis version -o json-compact
```

Use direct argv execution, explicit scope, structured output, and stable command
identity. Do not mutate the active CLI context or installation. The following
remain developer-owned: `context set`, `context set-value`, `llm use`,
`llm clear`, `update`, and `init`.

Agents never receive `--yes`. Trusted policy code may reconstruct an approved
destructive invocation only after exact arguments, scope, identity, and approval
are recorded.

Useful future CLI metadata includes stable command ID, descriptor version,
read/write/destructive effect, idempotency, side effects, data sensitivity,
required scope, dry-run support, and approval requirement. Add it in the CLI
repository because the command implementation owns the truth.

## Naming and packaging

Use Cratis product names rather than Pi-branded names. A practical package split
is factory core, Pi adapter, CLI tools, and the `cratis-factory` executable. A
future `cratis factory` command can only be a forwarding shim to the separately
installed product.

Pin Pi exactly, run compatibility evaluations before upgrades, and contribute
missing hooks upstream. Fork only for an essential production requirement that
public APIs cannot support and upstream declines over multiple release cycles.
