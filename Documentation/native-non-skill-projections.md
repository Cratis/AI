# Native non-skill static projections

**Status:** Repository-only generated fixtures; no installation or support claim

## Purpose

Some hosts document passive project-level rule or instruction files that are not
Agent Skills. S8 exercises those layouts without turning repository rules into
new canonical sources or installable packages.

The generator reads canonical component bytes once, projects only explicit
component-to-host mappings, writes a new isolated candidate tree, and rereads
and hashes every final file. It never writes into a project checkout or an S5b
root.

## Current fixture roots

| Root | Native layout | Semantic kind | Files |
| --- | --- | --- | ---: |
| `jetbrains-ai-assistant-rules` | `.aiassistant/rules/*.md` | rule | 34 |
| `tabnine-guidelines` | `.tabnine/guidelines/*.md` | rule | 34 |
| `visual-studio-copilot-instructions` | `.github/copilot-instructions.md` | instruction | 1 |
| `devin-hosted-instructions` | `AGENTS.md` | instruction | 1 |

The two singleton files use the canonical general-instruction bytes directly.
They do not copy the repository's existing path-reference or adapter files.
The rule roots do not add `general.md`; converting an instruction to a rule
would change its semantics.

## Safety boundary

Each projection is cataloged as `generated-static` with:

- passive canonical component bytes;
- `adapterType: generated`;
- `hostActivation: none`;
- `packageIdentity: null`;
- `provider-compatibility-v1` assurance;
- current official discovery-root evidence;
- support, installation, runtime, publication, and promotion denied.

The four roots contain no manifest, dependency, settings file, skill,
frontmatter wrapper, script, hook, MCP/LSP configuration, executable extension,
or generation receipt. The receipt remains outside the payload tree.

## Review snapshots

Maintainers can package the four isolated roots as deterministic review
snapshots without giving them package identity or installation semantics:

```bash
node tooling/package-native-non-skill-review-assets.mjs \
  /tmp/cratis-native-non-skill-review \
  0.0.1-candidate.1
```

The output contains one `tar.gz` snapshot per root, the exact projection receipt,
a component-coverage record for all 137 modeled components, a review SBOM,
checksums, and an explicit disposition for the two rules that do not yet have a
generated-static contract. The native review manifest and shared component
coverage conform to closed, digest-bound schemas under `distribution/`. The
snapshots retain `packageIdentity: null` and
`hostActivation: none`; every installation, runtime, publication, support, and
promotion grant remains false.

The manual **Package Passive Candidate Assets** workflow includes these four
snapshots in its seven-day review artifact alongside the public and engineering
skill candidates. It does not install them or transfer singleton files into a
project checkout.

## What this does not prove

Static layout documentation does not prove that a real host discovers, parses,
merges, updates, or removes these files correctly. S8 performs no host process,
installation, behavior, lifecycle, marketplace, or project-overwrite test.
Singleton project files also have no collision-safe merge contract yet.

Real-host canaries and project-context preservation belong to S9. S8 singleton
files still have no collision-safe install/merge contract, so S9 treats them as
placement/behavior candidates only rather than lifecycle packages. Until exact
host canaries pass, the fixture roots are test evidence only and are not offered
as packages.
