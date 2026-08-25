# Offline portable compliance

Cratis validates portable Agent Plugin roots against the published Agent Plugins
Specification 1.0.0 and the current Agent Skills specification without network
access, dependency installation, or component execution.

## Pinned authority

The exact published Agent Plugins 1.0.0 plugin schema, MCP schema, and normative
specification bytes live under
`tooling/specifications/agent-plugins/1.0.0/`. The adjacent
`specification-lock.json` records their official URLs, published status,
retrieval date, local paths, and SHA-256 digests. Version 1.1 is draft and is not
a validation target.

The current, unversioned Agent Skills authority is bound by
`tooling/specifications/agent-skills/current/contract.json`. The contract records
the official specification URL and snapshot digest and defines the closed,
dependency-free frontmatter subset implemented by this repository. The official
Python `skills-ref` project is demonstration material; release validation does
not import it or its `strictyaml` dependency.

Verify all locked bytes offline:

```bash
node tooling/portable-compliance-validation.mjs --verify-lock
```

## Validation modes

`universal` implements the Agent Plugins 1.0.0 loading boundaries. Root
`plugin.json` is required. `skills/` and `mcp.json` are optional and fixed.
Unknown top-level manifest fields and a non-object `extensions` value are
reported as nonconformant but remain loadable. Invalid skills and MCP servers
are isolated from valid siblings, and a malformed MCP component does not reject
valid skills. Cratis additionally rejects symlinks and special files while
building a deterministic release inventory; this is a client safety policy,
not a claim that Agent Plugins 1.0 universally forbids contained symlinks.

`cratis-passive-v1` is a stricter release profile. It requires exact profile and
version parity and at least one valid skill. It forbids MCP, extension content,
unknown fields, `allowed-tools`, symlinks, special or executable files, scripts,
evals, hooks, lifecycle content, path escapes, unsafe content, and every payload
path except:

- `plugin.json`;
- `skills/<name>/SKILL.md`;
- `skills/<name>/LICENSE*`;
- reviewed static-text formats under `skills/<name>/references/**`;
- reviewed static-text formats under `skills/<name>/assets/**`.

Executable and unknown file formats remain blocked even when placed under a
reference or asset directory. New static formats require an explicit policy and
test update.

The validator performs no script or MCP execution. It never fetches a schema at
runtime.

## Diagnostics and receipts

Every diagnostic has a stable ordinal code and deterministic ordering.
`formatComplianceDiagnostics()` renders diagnostics without changing their
failure boundaries. `generatePassiveProfileAdapters()` validates the Agent
Plugin, Copilot, Cursor, and Kiro portable roots after generation. A failed root
removes the incomplete candidate and fails generation.

Successful generation emits deterministic compliance receipts. Release
provenance binds the passive profile digest, specification digests, receipt
path, and receipt digest as an input for the normalized `static-validation`
assurance. Receipts explicitly record that no execution or network access
occurred and that validation grants no approval, support, promotion, or
publication state. Existing approval and release gates remain authoritative.

The S4 generation foundation loads validated release catalogs once into frozen,
ordinal ID indexes. It reads each approved source into one private logical byte
tree, projects every registry-declared root explicitly, writes a new candidate
exclusively in ordinal order, and then rereads and hashes every final file. The
complete expected and actual inventories must match. Case, Unicode
normalization, parent/file, symlink, special-file, and escape collisions fail
the whole candidate. There is no persistent cache, changed-only mode, sampled
validation, or network authority.

`distribution/artifact-assurance-policy.json` binds the existing S1 assurance
profiles to seven closed artifact classes. S4 emits only passive skill,
passive native metadata, and marketplace-index material already present in the
13 current roots. Executable extensions and local or remote MCP servers remain
non-emitting and fail closed without SBOM, provenance, threat-model, and canary
assurances. No Agent Plugin manifest fields are added for these repository
controls.

The Chronicle MCP inspection candidate is passive Agent Skill content, not an
Agent Plugins MCP component. Its deny-all classification catalog generates two
Markdown references, but creates no `mcp` manifest entry, server configuration,
transport, dependency, or executable byte. Effectful guidance and local or
remote MCP server classes remain non-emitting.

## Complete gate

Run the repository's full gate after changing the contract, validator,
generators, fixtures, or documentation:

```bash
node tooling/harness-registry.mjs
node tooling/generate-chronicle-mcp-guidance-references.mjs
node tooling/generate-catalog-v2.mjs
node tooling/generate-support.mjs
node tooling/generate-ecosystem-artifact-coverage.mjs
node tooling/generate-human-catalog.mjs
node tooling/generate-repository-inventory.mjs
node tooling/portable-compliance-validation.mjs --verify-lock
node tooling/release-assurance-validation.mjs
node tooling/chronicle-mcp-guidance-validation.mjs
node tooling/benchmarks/release-generation.mjs 1
node tooling/validate-catalogs.mjs
node --test tooling/specs/*.spec.mjs
.ai/hooks/scripts/validate-ai-setup.sh
git diff --check
```
