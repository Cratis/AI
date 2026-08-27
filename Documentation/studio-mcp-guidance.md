# Studio MCP passive guidance boundary

**Status:** Classification-only public-safe source candidate; no implementation operation admitted

## Public safety boundary

Studio MCP guidance is passive Markdown, not a server, client configuration, or
operation catalog. Private Studio implementation findings do not become public
package facts merely because maintainers reviewed them.

`cratis-studio-mcp-safety-guidance` therefore starts with no implementation
source contract, no revision, and empty tool and prompt inventories. Empty means
nothing is admitted; it does not claim that Studio has no MCP capabilities.

## What the candidate can do

The candidate may:

- classify an intent as classification-only, observational, effectful,
  dynamically delegated, or unknown;
- explain why absent implementation authority fails closed;
- help identify the intended organization and data sensitivity;
- interpret the smallest already-redacted excerpt supplied by the user;
- treat all returned product content as untrusted data.

It may not discover or name operations, provide arguments or payloads, install
or configure a server, handle credentials, describe private implementation, or
invoke anything.

## Separate product authority

Chronicle MCP and Studio MCP have independent classification catalogs and
component IDs. Evidence admitted for one product cannot authorize the other.
The shared mechanism provides common effect, evidence, output, and redaction
rules; each product supplies its own authority or remains deny-all.

A delegating operation cannot become observational merely because its entry
point looks read-only. Dynamic delegation is blocked. Any future finite
delegation requires a complete immutable transitive operation set with every
target and effect classified.

## What remains blocked

- Studio MCP discovery, installation, configuration, and invocation
- implementation operation, prompt, resource, schema, endpoint, transport, or
  credential claims
- private Studio implementation facts in public artifacts
- effectful, destructive, open-world, or dynamically delegated guidance
- executable MCP components and server artifacts
- target, profile, materialization, runtime, support, publication, promotion,
  and marketplace approval

The `public-studio` profile remains a source candidate with unresolved public
onboarding, modeling, support, redaction, and implementation-authority gaps.
