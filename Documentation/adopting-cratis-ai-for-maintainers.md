# Adopt Cratis AI in a Cratis repository

Cratis-maintainer profiles are public-safe shared engineering packages. The
`engineering-` prefix identifies the audience; it does not mean the package
contains confidential information or requires a private registry.

Packages are not published yet. Use this guide to prepare repositories and
review the intended adoption contract.

## Select shared engineering profiles

Choose the narrowest cell for the language(s) the repository actually writes,
and carry `cratis/documentation` next to it so documentation-writing guidance
arrives with everything else. A subscription deliberately mixes the public and
engineering channels in that case and leaves `channel` unset.

| Repository | Shared profiles |
| --- | --- |
| Cratis/Fundamentals | `cratis/engineering/csharp` + `cratis/documentation` |
| Cratis/Arc backend | `cratis/engineering/csharp` + `cratis/documentation` |
| Arc React packages | `cratis/engineering/react` + `cratis/documentation` |
| Cratis/Components | `cratis/engineering/react` + `cratis/engineering/typescript` + `cratis/documentation` |
| Cratis/Chronicle kernel | `cratis/engineering/csharp` + `cratis/engineering/react` + `cratis/application/csharp` + `cratis/application/react` + `cratis/documentation` |
| Chronicle client repository | the client's language cell + `cratis/documentation` |
| Cratis/cli | `cratis/engineering/csharp` + `cratis/documentation` |
| Cratis/Lens | `cratis/engineering/react` + `cratis/engineering/typescript` + `cratis/documentation` |
| Cratis/Screenplay | `cratis/engineering/csharp` + `cratis/documentation` |
| Cratis/Stage | `cratis/engineering/csharp` + `cratis/documentation` |
| Cratis/Specifications | `cratis/engineering/csharp` + `cratis/documentation` |
| Documentation | `cratis/engineering/typescript` + `cratis/documentation` |
| Cratis/AI | `cratis/engineering/typescript` + `cratis/documentation` |
| Cratis/Workflows | `cratis/engineering/core` + `cratis/documentation` |
| Private Studio repository | the cells above plus `cratis/application/csharp` and `cratis/application/react`, and a local overlay |
| Private Stagehand repository | the cells above plus `cratis/application/react` and `cratis/application/csharp`, and a local overlay |

Every engineering cell composes `cratis/engineering/core`, so the
decision-record, effect-boundary, and documentation-authoring procedures come
along regardless. A generated profile artifact contains only approved
public-safe skills and references. Browse the
[package and capability catalog](../catalog/generated/human-catalog/CATALOG.md)
to see each maintainer package, its included skills, and current availability.

## Prepare the repository

1. Add `.cratis/ai.json` with the exact profile and release version.
2. Add or refine `.cratis/PROJECT.md` with repository-owned product facts.
3. Keep `AGENTS.md` as a minimal bootstrap and repository policy surface.
4. Put private or repository-specific skills under `.agents/skills`.
5. Add only thin host adapters required by supported tools.
6. Run the repository's own build, specification, documentation, security, and
   release gates.

Example Chronicle repository subscription (mixed public and engineering
channels — note the absent `channel`, which a mixed selection does not
derive):

```json
{
  "schemaVersion": "1.0.0",
  "version": "1.0.0",
  "profiles": [
    "cratis/documentation",
    "cratis/engineering/csharp",
    "cratis/engineering/react",
    "cratis/application/csharp",
    "cratis/application/react"
  ],
  "harnesses": ["claude", "codex", "copilot", "cursor", "pi"],
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

Follow the complete [maintainer improvement workflow](./maintaining-shared-ai-behavior.md)
for ownership, temporary local workarounds, proposal evidence, canonical
implementation, release, downstream update, and rollback.

Classify the improvement before moving it:

- **General and public-safe:** propose it to `Cratis/AI`.
- **Product fact:** update the product repository first, then cite its immutable
  revision in the AI proposal.
- **Private/repository-specific:** keep it local.
- **Mixed:** split public workflow from private facts before proposing it.

A consuming repository never publishes a Cratis AI package and never pushes
local generated adapters back into `Cratis/AI`. Feedback travels upstream as a
reviewed proposal and immutable evidence; generated delivery travels downstream
through a new release.

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
