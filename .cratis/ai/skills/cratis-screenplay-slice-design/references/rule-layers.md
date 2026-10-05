# Rule layers

Put each rule in the lowest layer where it is true for every caller. Descriptions never reach
rendered code (Stage#178): a rule that exists only in prose is unenforced in rendered scope.

| Rule is about | Layer | Notes |
|---|---|---|
| format or meaning of a value, true wherever used | `concept` `validate` | travels with every use; a value some use must accept unchecked is a different concept. One rejection spec per concept (through one command), not per use |
| a predicate that is not a comparison (checksum, registry format) | `rule <Name>` on the property or concept | design mode; blocks V3 (PLAY0268) |
| this command's own inputs | command `validate` / `require` | a rule that applies only sometimes is an implication: `require a == false or b > c` |
| who may ask | `authorize` with a policy (role, claim, authenticated) | enclosing gates combine with AND and run first. Gates every command and query in a feature shares go on the feature or module so a new path inherits them |
| whose instance | policy `claim "x" matches subject` (the command identifier) or `matches <command property>` | executable; renders only for text-backed subjects (Uuid: STAGE-ESM-015) |
| uniqueness, once-only facts | `constraint` (`unique ... on`, `unique event`) | append-time; the constraint name is its identity |
| stored state (record exists, balance, current status) | `reads <View>` + `require <expr> message "..."` | stated intent, **NOT enforced in the model today** (PLAY0268/0271 at binding are expected in design mode; Screenplay#129/#209). Name the target: Arc `[ProtectedDecision]` + `DecisionRead<T>` (Arc 22.39.0 or later), Chronicle DCB (`concurrency` scope), or a constraint |

An unguarded materialized read is unsafe for a protected decision; a guarded read is the
supported route. Availability: `[ProtectedDecision]` and `DecisionRead<T>` need Arc 22.39.0 or
later and are **not available in Stage-rendered apps**, whose scaffold pins Arc 22.25.0 (Stage
4.24.0); never edit the managed dependency files to get them. For rendered scope, record a
capability gap (or a separately verified compatible enforcement path, such as a constraint or
a Chronicle DCB scope) and keep the rule as NOT enforced. Forbidden: caller-supplied copies of state in `require`, boolean attestation
inputs (`confirmsX == true`), rules in `handler` / implementation-hint prose.

## Authorization is executable

Persona Does/Reads/Cannot text is intent. Every Cannot line resolves to an `authorize` gate
(policy or ownership claim) plus a `then denied` spec whose `given caller` carries the roles
and claims standing for that persona; otherwise record a gap. Every command and query under an
inherited module/feature `authorize` gets its own `then denied` spec. Ownership gates need a
second caller with another claim value.

## Secrets and personal data

Command property values are, by default, recorded in the causation chain of the events they
produce, so treat them as permanent. Newer Chronicle versions can omit causation properties
(`CausationPropertyRetention.Omit`, Chronicle v19.32.0); rendered apps pin Chronicle 19.8.1.
Verify the actual auditing and retention configuration before relying on omission, and never
audit secrets. Never mark the identifier's
concept `@pii`; use a surrogate `Uuid` identity and carry the personal value as a `@pii`
property. Bearer tokens, magic links and signed URLs are never facts (record a keyed hash or
reference).
