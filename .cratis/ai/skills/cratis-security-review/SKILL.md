---
name: cratis-security-review
description: Perform a focused security review of changed code in a Cratis application — injection, authentication and authorization, data exposure, secrets, event-sourcing-specific exposure, and the frontend — and report findings by risk. Use when asked for a security review or audit. Do not use to implement authentication and do not report a policy preference as a framework contract.
license: MIT
---

# Cratis security review

Event sourcing changes the shape of a security review. A mistake in an ordinary
application is a bug you fix; a secret written into an append is a fact that
lives in the log forever and cannot be edited out. The event-sourcing section
below is the one that is specific to this stack, and it is the one worth reading
first.

## Verified product sources

| Package | Version | Purpose |
| --- | --- | --- |
| `Cratis.Arc.Chronicle` | `22.10.4` | `[NotAudited]` in `Cratis.Arc.Chronicle.Commands`; the `ARCCHR0009` analyzer |
| `Cratis.Chronicle` | `16.45.2` | `[PII]`, `[Subject]`, redaction, namespace isolation |
| `Cratis.Arc.Core` | `22.10.4` | Authorization filters, `CommandResult.Unauthorized` |

Reverify against the owning product repository before asserting a framework
guarantee this file does not already state.

## Route near misses

- General correctness and maintainability: use `cratis-code-review`.
- Scalability and resource use: use `cratis-performance-review`.
- Implementing authentication, authorization or identity: use
  `cratis-arc-authentication-authorization-and-identity`. This skill reviews;
  it does not build.
- Compliance mechanics — `[PII]`, subject resolution, erasure, redaction: use
  `cratis-chronicle-compliance`.

## Step 1 — Event sourcing: the permanent-record checks

- **Every `[Command]` property holding a secret is marked `[NotAudited]`.** A
  command's property values are written to the causation of every event it
  appends, and causation is as permanent as the events. Prefer the marking on
  the concept type so it travels everywhere the value appears.
  `ARCCHR0009` catches properties whose *names* read as secrets — so read the
  properties whose names do not say what they hold, because the analyzer cannot.
- **Personal data is `[PII]`, not `[NotAudited]`.** They are different
  mechanisms with different consequences: `[NotAudited]` withholds a value from
  the causation chain; `[PII]` enrolls it in per-subject encryption and erasure.
  A password is `[NotAudited]`. An email address is `[PII]`. Neither substitutes
  for the other.
- No secret, token, API key or password in an event property or a read model.
- Event-source ids are generated server-side, never accepted from an untrusted
  client where the id grants access to a stream.
- Upcasting and event-type migration logic cannot introduce a property the
  original contract did not carry.
- Uniqueness cannot be bypassed by concurrent writes — it is enforced by a
  Chronicle constraint, not by a read-model pre-check.
- Cross-tenant writes cannot bypass a constraint that is scoped per namespace.

## Step 2 — Input validation and injection

- Every command property is validated before use — null, empty, range, format.
- No raw SQL concatenation; parameterized queries or EF Core only.
- No user-supplied value reaches `Path.Combine`, a `File.*` call, a shell
  command, or process arguments.
- No user-supplied value becomes an event-store key without sanitization.

## Step 3 — Authentication and authorization

- Every exposed endpoint is either authorized or explicitly anonymous with a
  stated reason.
- Authorization is expressed at the boundary — an attribute, a policy, a command
  filter — never as an `if` on roles inside `Handle()`.
- Tenant isolation holds: no cross-namespace data is reachable without
  authorization.
- Claims are verified before acting on identity-dependent command data. A client
  must not be able to assert who it is through a command property.
- Note that an unauthorized command result maps to HTTP **403**, not 401 — a
  reviewer reading logs for 401s will miss authorization failures.

## Step 4 — Data exposure

- No personal data is returned to a caller that did not supply it.
- Query results are scoped to the requesting tenant and user. A query that can
  return all-tenant data is a finding even when no current caller reaches it.
- Response payloads carry only fields the client uses. Over-fetching is an
  exposure surface, not only a performance one.
- A managed read-model document holds one subject's personal data. Mixing
  several people's data in one document breaks erasure.

## Step 5 — Secrets and configuration

- No secret in source, in a configuration file, or in a specification fixture.
- Secrets come from environment variables or a secrets manager.
- No hard-coded connection string outside test code.

## Step 6 — Frontend

- No user-supplied value in `dangerouslySetInnerHTML`.
- No token or secret in `localStorage` — use an `httpOnly` cookie or in-memory
  state.
- Command payloads carry only the minimum required fields.
- No client-side access control that is not also enforced server-side. A
  disabled button is a usability affordance, never a control.

## Step 7 — Report

Open with one line:

> **Security review: No issues / Low-risk findings / Blocking issues found**

Group findings by the section that produced them, and classify each:

| Risk | Meaning |
| --- | --- |
| **Critical** | Must be fixed before merge |
| **Medium** | Should be fixed soon; state what makes it not-critical |
| **Low** | Fix when convenient |

Close with a per-section summary table, and **name what you did not review** —
the paths, the surfaces, and the axes out of scope. A security report listing
only findings reads as a clean bill of health for everything it never opened.

## What breaks

- **A finding is a policy preference in framework clothing.** Which roles exist,
  which data is sensitive, and which retention applies are the product's calls,
  not the framework's. State them as policy questions for the owner, not as
  contracts.
- **`[NotAudited]` is used for personal data.** The value stays out of causation
  but is never encrypted and never enrolled in erasure — the opposite of what a
  subject-rights request needs.
- **The review assumes the analyzer covered the secrets.** `ARCCHR0009` matches
  names. A property called `Value` holding an API key passes it silently.
- **A missing check is reported as "verified".** Unknown is not pass. If a
  surface could not be reached, say so as `indeterminate` rather than omitting
  it.

## How it is proven

The build and specifications are green before the report is written; each
finding cites the file and line; and the report states explicitly which
surfaces were and were not examined.
