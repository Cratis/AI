# Factory security and privacy

## Security boundary

Prompts, tool descriptions, MCP annotations, and post-run Git rollback are not
authorization controls. The enforceable boundary is the disposable worker, its
capability policy, scoped credentials, network policy, protected workspace,
deterministic publisher, and authenticated protocol.

Every unattended run requires:

- A non-root ephemeral container or equivalent sandbox with a read-only root
  filesystem.
- An immutable base revision and dedicated branch/worktree.
- The policy engine and gates mounted outside the agent's write set.
- Default-deny network egress with explicit per-phase destinations.
- Short-lived secrets injected only into the phase that needs them.
- Structured tools where practical; restricted shell access only inside the
  sandbox.
- Path normalization, symlink-escape protection, and post-phase write-set
  verification.
- Time, turn, tool-call, cost, output-size, and correction limits.
- Exact worker/Pi/extension pins, lockfiles, SBOMs, provenance, scanning, and an
  extension allowlist.
- Idempotent callbacks and publisher operations so retries cannot duplicate
  comments, commits, pull requests, merges, deploys, replays, or migrations.

Agents propose patches and publisher metadata. Trusted code commits, pushes,
comments, merges, deploys, and performs runtime mutations after policy and
approval gates.

## Untrusted inputs

Treat source code, issue text, documentation, dependency output, runtime
payloads, Screenplay content, CLI/MCP results, artifacts from prior phases, and
model output as potential prompt injection. Never allow retrieved content to
expand tool, network, credential, write, or approval scope.

An agent cannot modify the policy or gate evaluating its run, approve its own
elevated action, or select a less restrictive provider for classified data.

Native schema validation does not make a schema trusted. `Factory.Core` parses
schema and instance bytes through the bounded canonical JSON contract, admits
only its documented Draft 2020-12 surface, and resolves every reference against
an immutable caller-supplied closure. An `http` or `https` identifier never
causes retrieval. Missing, remote-only, duplicate, conflicting, cyclic without
instance progress, or over-limit resources fail closed before validation.

Core rewrites references only in a private validator copy after their targets
have been admitted, then uses an isolated local package registry. A
process-global schema registration or fetch hook cannot substitute for supplied
bytes. Logical schema identifiers are exact, printable-ASCII HTTPS contract
metadata and appear in typed results only after admission; callers must not put
PII, filesystem paths, credentials, or other secrets in them. Invalid or unsafe
identifiers are rejected without echoing their value.

The accepted private static-rebasing design contains the confirmed
JsonSchema.Net 8.0.5 embedded-resource build failure without retrying through
evaluation. Each resource is built with inert Factory-owned identifier handlers
and a fresh complete local registry whose fetch hook is null, then checked
structurally against Factory's preflight graph. Poisoned package-global
registrations and fetch hooks cannot substitute for caller-supplied bytes.

Schema diagnostics discard package prose and raw values. Object-member segments
in instance and keyword locations are represented by full SHA-256 tokens, so
attacker-controlled property names, terminal controls, PII, paths, and secrets
do not become output. Regular-expression matching uses the bounded Factory
handler; the wrapped package's unbounded default is not used. See
[`Factory/SchemaValidation.md`](../../Factory/SchemaValidation.md).

## PII and sensitive data

PII must be a first-class classification that follows data through model,
source, runtime tools, artifacts, telemetry, and provider routing.

- Derive domain classifications from Screenplay PII/sensitive declarations and
  Chronicle schemas where available.
- Treat subjects, identities, event payloads, read-model documents, emails,
  tokens, stack traces, and source/issue content as potentially sensitive.
- Route restricted inputs only to explicitly compatible providers and regions.
- Redact runtime payloads, subjects, identities, credentials, and secrets before
  telemetry persistence.
- Persist sanitized facts, classifications, counts, hashes, and approved
  references in Chronicle—not raw payloads.
- Use trusted-control-plane-issued `run-actor:<opaque digest>` approval
  references. Never persist the approving user's ID, email, Chronicle subject,
  account name, or an unkeyed hash of a stable identity in an approval decision.
- Encrypt raw transcripts/artifacts when retention is necessary; restrict access
  and set a short deletion deadline.
- Use separate development and production identities. Coding phases receive no
  production credential.
- Add adversarial evaluation cases for subject propagation, cross-cutting PII
  deletion, data leakage, and prompt injection.

Development Chronicle reads use a typed grant with exact command identities and
server/event-store/namespace scope, allowed fields, maximum records, short-lived
credential reference, expiry, retention, classification, and independent
approver. Raw restricted values stay in trusted code; agents receive capped
aggregates, equality relations, and run-scoped pseudonyms.

The original developer confusion around read-model subjects is exactly the kind
of regression the factory should prevent: a skill can teach the convention, but
a compiler/analyzer or deterministic evaluation should ultimately verify that
returned event subjects, event context, and projection/read-model subject
selection behave as intended. Agent confidence is not evidence.

## Operational capability defaults

| Capability                      | Initial default            |
| ------------------------------- | -------------------------- |
| Read repository/model           | Allow in scoped workspace  |
| Propose Screenplay/source patch | Allow in sandbox           |
| Build, analyze, and test        | Allow in sandbox           |
| Create a branch/pull request    | Independent project policy |
| Merge                           | Human approval             |
| Read development Chronicle      | Explicit scoped grant      |
| Mutate development Chronicle    | Per-operation approval     |
| Read production                 | Deny                       |
| Mutate production               | Deny                       |
| Deploy                          | Deny                       |

“Autonomous” is a set of explicit grants, not a Boolean that silently spans
coding, publishing, deployment, and runtime operations.

## Evidence minimization

The durable ledger records request/revision IDs,
workflow/profile/policy/worker/harness versions and hashes, phase and gate
outcomes, classified artifact references, approvals, usage summaries,
pull-request outcomes, and later defect signals.

Inline summaries are finite, control-safe, explicitly classified sanitized
facts. C0, C1, Unicode bidirectional controls, Unicode zero-width format
characters (`U+200B`-`U+200F`, `U+FEFF`), and the Unicode line and
paragraph separators `U+2028` and `U+2029` are rejected. Only fields explicitly
marked multiline by their contract may contain bounded newlines, and that
allowance admits only the newline itself.
Raw command invocations, approval reasons, failure details, tool/model content,
and phase handoff notes remain classified content-addressed artifacts. Artifact
references are opaque `artifact:sha256:<digest>` identifiers rather than paths,
URLs, subjects, or customer-derived names.

Do not durably store provider keys, callback credentials, raw source archives,
complete model conversations, full tool arguments/outputs, raw event/read-model
payloads, or customer identities by default. Redaction happens before data
crosses the worker trust boundary, not only when rendered in a UI.
