# Contexts and context expressions

Four contexts, one per job. What each **omits** is as deliberate as what it
carries: a validation rule cannot see the caller's roles, and a policy cannot see
the causation chain.

## The four contexts

```csharp
public record CommandContext(
    dynamic Command, TenantId Tenant, Identity Identity,
    CausedBy CausedBy, Causation Causation, DateTimeOffset Occurred);

public record QueryContext(
    dynamic Arguments, TenantId Tenant, Identity Identity,
    CausedBy CausedBy, Causation Causation, DateTimeOffset Occurred);

public record RuleContext(
    dynamic Artifact, dynamic Value, string Property,
    TenantId Tenant, CausedBy CausedBy, DateTimeOffset Occurred);

public record PolicyContext(
    dynamic Artifact, string Subject, Identity Identity,
    TenantId Tenant, DateTimeOffset Occurred);
```

| Context | In scope for | Omits | Why |
| --- | --- | --- | --- |
| **Command** | a command `handler` | — | the full picture |
| **Query** | a query `performer` | — | same, with `Arguments` instead of `Command` |
| **Rule** | a `validate` rule body | **`Identity`** | a rule *may* reject based on who sent it — "you may not approve your own request" is validation, and `CausedBy` carries the caller's identifier for it. Inspecting **roles or claims** is authorization and belongs in a `policy`; leaving those out is what keeps the two apart |
| **Policy** | a `policy` code block | **`CausedBy`, `Causation`** | a decision about the caller, not an audit record |

`RuleContext` carries `Artifact` (the whole thing under validation), `Value` (the
value the rule is declared on) and `Property` (where it sits — empty for a
whole-command `require`).

## The values they carry

| Type | Members |
| --- | --- |
| `Identity` | `Id`, `Name`, `UserName`, `IsAuthenticated`, `Roles`, `Claims` |
| `Claim` | `Name`, `Value` |
| `CausedBy` | `Subject`, `Name`, `UserName` |
| `Causation` | `Type`, `Occurred`, `Properties` |

`Identity` is the **authorization** view of the caller — what a policy decides on.
`CausedBy` is the **audit** view of the same caller — the three values that travel
with an appended event.

## Reaching the context declaratively

Usable wherever a mapping source is — `produces` mappings, `seed` values, capture
`append` mappings, query `from` parameters:

| Path | Yields |
| --- | --- |
| `$context.occurred` | when the command or query was received |
| `$context.tenant` | the tenant |
| `$context.command.<property>` | a command property (in commands) |
| `$context.arguments.<name>` | a query argument (in queries) |
| `$context.identity.id` | the caller's identifier |
| `$context.identity.name` / `.userName` | display name / user name |
| `$context.identity.isAuthenticated` | whether the caller is authenticated |
| `$context.identity.roles` | the caller's roles |
| `$context.identity.claims.<name>` | one claim value |
| `$context.causedBy.subject` / `.name` / `.userName` | the audit view |
| `$context.causation.type` | the causation type |

An unknown `$context.` path is reported, so a typo does not silently become null.

## The other expression roots

| Root | Where | Yields |
| --- | --- | --- |
| `$env.<VAR_NAME>` | mapping sources | an environment variable |
| `$eventContext.<property>` | **projections only** | `occurred`, `sequenceNumber`, `correlationId`, `eventSourceId` |
| `$eventSourceId` | **projections only** | shorthand for `$eventContext.eventSourceId` |
| `$causedBy.<property>` | **projections only** | `subject`, `name`, `userName` — an unknown one is an error naming all three |
| `$.` | **captures only** | a value from the current source item |
| `$strings.<dotted.key>` | labels, titles, messages | a localized string from a `.strings` file |

## Templates and literals

A template is backticked with `${}` substitutions:

```screenplay
fullName = `${firstName} ${lastName}`
```

Literals are `true` / `false`, `"quoted text"`, numbers (`42`, `-3.14`), and
`null`. In a projection, `literal <value>` forces a value to be read as a literal
rather than a property path — that is how a constant key is written:

```screenplay
from UserLoggedIn key literal "site-stats"
  count TotalLogins
```

⚠️ A template expression is **not allowed in a composite key**, and a composite
key with no parts is an error.

## Escaping

A reserved word used as a property name is escaped with a leading `@` —
`@with`, `@file`, `@validate`. This matters most in three places:

- a `trigger` body reserves `file`, so a trigger value named `file` is `@file`;
- an `Enum` concept value named `validate` is `@validate`, or it reads as an
  empty validate block;
- a projection clearing a property named `with` is `clear @with`.
