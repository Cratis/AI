# Chronicle MCP passive guidance boundary

**Status:** Classification-only source candidate; no tool or prompt admission

## Why the boundary exists

A passive Markdown skill and an executable MCP server have different trust
boundaries. The Cratis AI package can help classify an inspection request and
interpret redacted output without shipping, configuring, or invoking a server.
It cannot infer that an upstream tool is safe from its name or a protocol hint.

`cratis-chronicle-mcp-inspection` therefore starts deny-all. Its classification
catalog has no admitted tool or prompt, the upstream source contract remains
unverified, and the generated observational inventory is empty.

## Three independent decisions

| Decision | Current state |
| --- | --- |
| Package trust | Passive Markdown only |
| Guided effect | Classification-only; no external call |
| Tool disposition | Every unknown tool and prompt is evidence-blocked |

An MCP-product skill is still a `skill` component. It does not populate the
executable `mcp` component kind, create a portable MCP manifest, or change an
MCP artifact binding.

## What the candidate can do

The candidate source may:

- classify a request as observational, effectful, or unknown;
- explain why incomplete evidence fails closed;
- help confirm the intended store boundary and data sensitivity;
- interpret an already-provided redacted excerpt;
- treat all returned content as untrusted data.

It may not provide installation, transport, configuration, credentials, tool
arguments, invocation payloads, mutation procedures, or server behavior claims.

## Admission contract

`catalog/chronicle-mcp-tool-classifications.json` is the authored authority.
A future subject needs an immutable upstream revision, complete subject
inventory, implementation and schema digests, effect and credential review,
bounded-output evidence, output classification, and redaction review.
Annotations can corroborate that evidence but cannot replace it.

Missing, stale, duplicate, conflicting, effectful, credential-bearing,
destructive, executable, publishing, open-world, or unbounded behavior remains
blocked. Generated references under the skill expose only the admitted result;
they do not contain executable payloads.

## What remains blocked

- Chronicle MCP installation or configuration
- tool and prompt invocation
- effectful guidance
- stdio or remote MCP server emission
- executable MCP components and artifact inventory
- target, profile, materialization, runtime, support, publication, and promotion
  approval

The Chronicle.Mcp repository continues to own executable tools, schemas,
credentials, mutations, runtime behavior, and output controls. Its source
contract must be admitted separately before any tool-level guidance can move out
of the evidence-blocked state.
