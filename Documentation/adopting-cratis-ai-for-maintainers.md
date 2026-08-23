# Adopt Cratis AI in a Cratis repository

Cratis-maintainer profiles are public-safe shared engineering packages. The
`engineering-` prefix identifies the audience; it does not mean the package
contains confidential information or requires a private registry.

Packages are not published yet. Use this guide to prepare repositories and
review the intended adoption contract.

## Select shared engineering profiles

Choose the narrowest product/repository profile:

| Repository | Shared profile |
| --- | --- |
| Cratis/Fundamentals | `engineering-fundamentals` |
| Cratis/Arc backend | `engineering-arc` |
| Arc React packages | `engineering-arc-react` |
| Cratis/Components | `engineering-components` |
| Cratis/Chronicle kernel | `engineering-chronicle` |
| Chronicle client repository | `engineering-chronicle-clients` |
| Cratis/cli | `engineering-cratis-cli` |
| Cratis/Lens | `engineering-lens` |
| Cratis/Screenplay | `engineering-screenplay` |
| Cratis/Stage | `engineering-stage` |
| Cratis/Specifications | `engineering-specifications` |
| Documentation | `engineering-documentation` |
| Cratis/AI | `engineering-ai` |
| Cratis/Workflows | `engineering-workflows` |
| Private Studio repository | `engineering-studio` plus local overlay |
| Private Stagehand repository | `engineering-stagehand` plus local overlay |

Every engineering profile composes `engineering-base`. A generated profile
artifact contains only approved public-safe skills and references.

## Prepare the repository

1. Add `.cratis/ai.json` with the exact profile and release version.
2. Add or refine `.cratis/PROJECT.md` with repository-owned product facts.
3. Keep `AGENTS.md` as a minimal bootstrap and repository policy surface.
4. Put private or repository-specific skills under `.agents/skills`.
5. Add only thin host adapters required by supported tools.
6. Run the repository's own build, specification, documentation, security, and
   release gates.

Example Chronicle framework subscription:

```json
{
  "schemaVersion": "1.0.0",
  "channel": "cratis-engineering",
  "version": "1.0.0",
  "profiles": ["engineering-chronicle"],
  "harnesses": ["claude", "codex", "copilot", "pi"],
  "updatePolicy": "reviewed-pull-request",
  "projectContext": ".cratis/PROJECT.md"
}
```

## Separate shared behavior from product facts

| Put in shared Cratis AI | Keep in the product repository |
| --- | --- |
| Public API workflow and trigger intent | Exact current APIs and implementation evidence |
| General contributor conventions | Build/test/release commands specific to the repository |
| Public-safe specification/review guidance | Unreleased behavior and private architecture |
| Profile composition | Credentials, endpoints, infrastructure, incidents, customers |
| Cross-harness package adapters | Repository-local exceptions and operational policy |

Product facts may inform a shared skill only through an immutable source
contract and product-owner review.

## Work in a private repository

Install the same public-safe engineering package. Add a private overlay locally;
do not request a special package merely because the repository is private.

Private Studio example:

```text
AGENTS.md
.cratis/PROJECT.md
.cratis/ai.json
.agents/skills/studio-local-release/SKILL.md
.pi/settings.json
```

See the complete
[`private-repository-overlay`](./examples/private-repository-overlay/README.md)
example.

## Upstream an improvement

Classify the improvement before moving it:

- **General and public-safe:** propose it to `Cratis/AI`.
- **Product fact:** update the product repository first, then cite its immutable
  revision in the AI proposal.
- **Private/repository-specific:** keep it local.
- **Mixed:** split public workflow from private facts before proposing it.

A consuming repository never publishes a Cratis AI package and never pushes
local generated adapters back into `Cratis/AI`.

## Review an update pull request

Verify that the pull request:

- changes only exact subscription/package settings;
- points to an immutable release with checksums and provenance;
- contains the expected profile and skill inventory;
- does not modify project context or local private skills;
- passes repository-specific gates;
- can be rolled back to the previous exact pin.

Do not auto-merge profile updates. A failed canary leaves the current stable pin
unchanged.
