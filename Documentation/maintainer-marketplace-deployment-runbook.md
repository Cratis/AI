# Maintainer runbook — installing Cratis AI, and getting it listed

> **Audience:** Maintainers of Cratis/AI — manual marketplace deployment steps. Not required for adopting Cratis AI.

Audience: a Cratis maintainer with owner rights.

Two separate things:

- **Installing** — works today, zero setup, covered below.
- **Getting listed** in a host's own marketplace UI (so someone who doesn't
  already know `Cratis/AI` exists can find it) — a manual, per-vendor
  submission. Status: **Anthropic and Cursor submissions opened** by the
  maintainer (2026-09); the **Copilot PR is prepared below, ready to open**;
  **Codex is blocked** on non-repository inputs (identity verification, legal
  pages, logo). Tracked in
  [Cratis/AI#147](https://github.com/Cratis/AI/issues/147). Guides below.

## Installing

```text
/plugin marketplace add Cratis/AI
/plugin install cratis@cratis
```

```bash
codex plugin marketplace add Cratis/AI
copilot plugin marketplace add Cratis/AI
copilot plugin install cratis@cratis
```

Maintainers who also want the engineering skills:

```text
/plugin install cratis-engineering@cratis
```

No ref, no version, no tag — every host reads the manifest on `main` and
resolves a directory straight out of this repo.

## Getting listed — status

Built and verified (2026-09-08): every marketplace entry now carries
`version`, `author`, `homepage`, `repository`, `license` — for both `cratis`
and `cratis-engineering`, on all four hosts. `cratis-engineering`'s plugin
root (`engineering/`) also got a real per-host `plugin.json`
(`.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`, `.github/plugin/`),
matching the convention verified against a real accepted listing
(`microsoft/work-iq` in `github/copilot-plugins`). `claude plugin validate
./engineering --strict` passes clean. Full internal spec suite
(`node --test tooling/specs/*.spec.mjs`) is green, 590 passing.

**Blocked for `cratis` (the public plugin — the one that actually matters
for "findable in Claude Desktop"):** `cratis`'s plugin root is `skills/`
itself, which is also this repository's strictly-governed canonical-source
root — every file under it must be owned 1:1 by a skill component in
`catalog/components.json`, and a plugin-manifest file doesn't fit that model.
Confirmed with the real CLI:

```bash
$ claude plugin validate ./skills
✘ No manifest found in directory. Expected .claude-plugin/marketplace.json or .claude-plugin/plugin.json
```

The marketplace-level `strict: false` shim still makes installing work fine
(`claude plugin validate .` at the repo root passes clean) — what's unproven
is whether a vendor's *submission review* accepts that shim the same way, or
insists on the same per-plugin manifest `cratis-engineering` now has. That's
genuinely unknown without trying a real submission.

**Recommended next step:** submit `cratis` as-is (free, self-serve,
reversible — see Claude below) and see whether it's accepted. If a reviewer
rejects it over the missing manifest, that's the signal to do the fix
properly: nest `skills/`'s 48 skill directories one level under a wrapper
(matching how `engineering/skills/` already works cleanly), add the four
`plugin.json` files there, and update `catalog/components.json`'s 48
canonical-source paths to match. That touches roughly **86 files** across
generators, specs, and fixtures — scoped, mechanical, but real; a deliberate
follow-up, not something to do speculatively before a vendor asks for it.

### Claude

**Submission opened by the maintainer (2026-09).** The form values below stay
as the record of what was filled in. The listing points back at this repo's
root marketplace, so the manifests on `main` are the live definition — the
review outcome also settles the manifest question for the Copilot PR (see
below).

1. Submit: **[platform.claude.com/plugins/submit](https://platform.claude.com/plugins/submit)**.
   Fill in the form exactly like this:

   | Field | Value |
   | --- | --- |
   | Link to plugin | `https://github.com/Cratis/AI` |
   | Path within repository | *(leave blank)* |
   | Plugin homepage | `https://www.cratis.io` |
   | Plugin name | `cratis` |
   | Plugin description | `Public Cratis skills for developers building event-sourced CQRS applications with Cratis Chronicle and Arc — vertical slices, BDD specs, and a React + Cratis Components frontend.` |
   | Example use cases | `Add a new vertical slice (command, events, projection, React page) following Cratis conventions` · `Write BDD-style specs for a Chronicle event-sourced command or read model` · `Review a pull request against Cratis architecture, security, and performance conventions` |

   **Leave the path blank, don't point it at `skills`** — `skills` (the
   actual plugin folder) fails `claude plugin validate` today (see the
   blocked-plugin section above); the repo root resolves
   `.claude-plugin/marketplace.json` instead, which passes clean. Whether
   their review treats "root" as the whole marketplace or picks one plugin
   isn't publicly documented — root is still the only option that validates
   today.
2. Wait for automated validation + a safety screen (no published turnaround).
   If it's rejected for the missing plugin manifest, see the restructure
   above.

Once accepted, nothing more to do — Anthropic's own CI pins to a commit SHA
and bumps it as you push to `main`. Docs:
[plugins](https://code.claude.com/docs/en/plugins.md) ·
[reference](https://code.claude.com/docs/en/plugins-reference.md)

### Codex

**Not ready to submit — this is a full app-store listing, not a link-and-go
form, and several required fields have no answer yet.** Confirmed by fetching
the actual submission page
([developers.openai.com/plugins/deploy/submission](https://developers.openai.com/plugins/deploy/submission)):

Prerequisite before the form is even reachable: an organization role with
**Apps Management: Write**, plus completed individual/business identity
verification in the OpenAI Platform.

| Tab | Field | Required | Status for Cratis |
| --- | --- | --- | --- |
| Info | Plugin name | Yes | `cratis` |
| Info | Short / long description | Yes | Have this — reuse the Claude description above |
| Info | Developer Identity | Yes | **Missing** — needs OpenAI Platform identity verification (individual or business) |
| Info | Logo | Yes | **Missing** — no production-ready logo asset prepared |
| Info | Category | Yes | Pick at submission time (e.g. Developer Tools) |
| Info | Website | Yes | `https://www.cratis.io` |
| Info | Support URL | Yes | **Missing** — cratis.io has no dedicated support page (checked: no `/support`, `/contact`) |
| Info | Privacy Policy URL | Yes | **Missing** — no privacy policy page exists |
| Info | Terms URL | Yes | **Missing** — no terms-of-service page exists |
| Skills | Skill bundle | Conditional | **Missing** — Codex wants an uploaded packaged bundle, not just a repo link |
| Prompts | Starter prompts | Yes | Can draft from existing skill descriptions |
| Testing | 5+ positive / 3+ negative test cases | Yes | **Missing** — not written |
| Global | Country/region availability | Yes | Pick at submission time |
| Submit | Release notes, policy attestations | Yes | Straightforward once everything else is ready |

MCP tab doesn't apply — Cratis AI ships passive skills only, no MCP server.

**Ready-to-paste answers** — the two fields draftable without legal or design
input; everything else marked Missing above needs a human decision first.

Starter prompts:

- `Implement a new vertical slice — command, events, projection, React page — following Cratis conventions`
- `Write BDD specs for an event-sourced command or read model`
- `Review this pull request against Cratis architecture, security, and performance conventions`
- `Add a strongly typed domain concept with invariants that travel with the value`
- `Diagnose why a read model is not updating from appended events`

Test cases (5 positive / 3 negative):

- *Positive:* asking for a new vertical slice yields backend-first work —
  command + validator + events, then specs, then React from generated
  proxies.
- *Positive:* asking for command specs yields `CommandScenario` specs under a
  `for_/when_/` hierarchy with past-tense event names.
- *Positive:* asking for a PR review checks the slice against the
  architecture, security, and performance rule sets and cites them.
- *Positive:* asking for a domain value yields a `ConceptAs<T>` /
  `EventSourceId<T>` type with a `ConceptValidator<T>`, not a raw primitive.
- *Positive:* asking about a stale read model walks a symptom → cause →
  owning rule/skill flow instead of guessing.
- *Negative:* asking to bypass event sourcing (write directly to the read
  model store) is corrected to the convention, not complied with.
- *Negative:* asking to publish, push, or bulk-mutate external state without
  explicit authorization stops at the requested verb (ship-changes policy).
- *Negative:* asking to hand-edit a generated proxy file is refused; fixing
  the C# source and rebuilding is prescribed instead.

The privacy policy and terms-of-service pages are legal documents — draft and
publish those as a deliberate decision, not something to improvise into
existence to unblock a submission. Until those three "Missing" rows are
filled, this submission can't be completed regardless of the plugin-manifest
question above. Docs: [build a plugin](https://developers.openai.com/codex/plugins/build)

### GitHub Copilot

No form — it's an ordinary GitHub pull request, confirmed against their real
`CONTRIBUTING.md`: fork, branch, change, push, open a PR, wait for normal
review. No portal, no extra fields.

1. Fork **[github/copilot-plugins](https://github.com/github/copilot-plugins)**,
   branch, and add this entry to its `.claude-plugin/marketplace.json`
   `plugins` array (shape verified against their own accepted listing,
   `microsoft/work-iq`):

   ```json
   {
     "name": "cratis",
     "description": "Public Cratis skills for developers building event-sourced CQRS applications with Cratis Chronicle and Arc — vertical slices, BDD specs, and a React + Cratis Components frontend.",
     "version": "1.0.0",
     "author": { "name": "Cratis", "url": "https://www.cratis.io" },
     "homepage": "https://github.com/Cratis/AI",
     "repository": "https://github.com/Cratis/AI",
     "license": "MIT",
     "source": { "source": "github", "repo": "Cratis/AI", "path": "skills" }
   }
   ```

2. PR **prepared, not yet opened**. The one open question is whether
   `github/copilot-plugins`' review accepts the manifest-only shim — their
   own accepted listings (e.g. `microsoft/work-iq`) all carry a real
   `.github/plugin/plugin.json` in the plugin root, which `cratis` doesn't
   have. The in-flight Anthropic submission answers the same question first:
   **if Anthropic accepts, open this PR as-is; if a reviewer rejects over the
   missing manifest, do the `skills/` restructure first** (nest the skills
   under a wrapper matching `engineering/`, add the four `plugin.json` files,
   update `catalog/components.json` and the generators/specs that watch the
   paths — a deliberate ~100-file change, not a speculative one).

Docs: [finding and installing plugins](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-finding-installing)

### Cursor

**Submission opened by the maintainer (2026-09).** The form could not be
verified from outside (`cursor.com/marketplace/publish` is a client-rendered
app behind sign-in), so no field values are recorded here.

Every future update needs a fresh manual review on Cursor's side — this one
never becomes hands-off, no matter what we automate.

Note: Cursor has no free/individual self-hosted install path either (unlike
the other three) — adding a repo as a source requires a Team/Enterprise
admin. Docs: [marketplace](https://cursor.com/marketplace)

### What this means for automation

Claude, Codex, and Copilot listings point back at this repo — once accepted,
no repeat pushes needed. Cursor's mandatory per-update review means it can't
be made fully automatic. The `version` field needed for that is now in place
(`1.0.0`, tracked by `tooling/specs/marketplace-pointer-manifests.spec.mjs`)
— bump it by hand on future releases; nothing runs that automatically yet.

## Reference: the manifest files

| File | Read by |
| --- | --- |
| [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) | Claude Code |
| [`.agents/plugins/marketplace.json`](../.agents/plugins/marketplace.json) | Codex |
| [`.github/plugin/marketplace.json`](../.github/plugin/marketplace.json) | GitHub Copilot |
| [`.cursor-plugin/marketplace.json`](../.cursor-plugin/marketplace.json) | Cursor |

Each declares two plugins: `source: {"source": "github", "repo": "Cratis/AI", "path": "skills"}`
and the same with `path: "engineering"`. Hand-authored, no generator.

- `strict: false` (plus `skills: "./"`) **only on the `cratis` entry** —
  `skills/` carries no `plugin.json` yet, so the marketplace entry is the
  whole definition for it. `cratis-engineering` has real per-host manifests
  and uses default strict behavior.
- Adding a skill under `skills/` or `engineering/skills/` is the entire
  deployment — live for every host on the next merge to `main`. Editing a
  manifest is only needed to add/rename a *plugin*.
- `tooling/specs/marketplace-pointer-manifests.spec.mjs` enforces this shape.
- Claude Code and Copilot manifest shapes are verified against published
  references; Codex and Cursor reuse the same shape but aren't yet confirmed
  by a real install.
- Gemini CLI and Pi read a manifest at the repo root, which this repo
  doesn't have — no working install for those two today (open decision, see
  [`distribution/marketplace-requirements.json`](../distribution/marketplace-requirements.json)).
- Install evidence under `distribution/evidence/s9-*` was recorded against
  the deleted `distribution` branch and needs re-running per host.

## What actually publishes: `@cratis/ai-fundamentals`

[`release-passive-previews.yml`](../.github/workflows/release-passive-previews.yml)
publishes the npm package on merge to `main` under a release-intent label.
The package bundles the whole `skills/` directory — the same bytes the
marketplace installs resolve — anchored by the fundamentals concept authority.

- npm trusted publishing (OIDC), no token — bound to this exact workflow
  filename, org `Cratis`, repo `AI`, environment `npm-stage`. **Renaming the
  file breaks publishing.**
- `id-token: write` scoped to the publish job only (`tooling/specs/workflow-safety.spec.mjs` asserts this).
- Publishes stable `1.0.0`-or-newer versions to npm `latest` — label the
  release PR `major` for the `1.0.0` bump. Needs npm ≥11.5.1, Node 24.

| Environment | State | Used by |
| --- | --- | --- |
| `npm-stage` | No required reviewer | `release-passive-previews.yml` |
| `distribution-canary` | Required reviewer `woksin` | Nothing — unreferenced, left in place deliberately |

## Other open items

- **Canary consumer ring** — [Cratis/Workflows#71](https://github.com/Cratis/Workflows/issues/71).
  No real host lifecycle evidence without one; blocks leaving the basic
  assurance lane.
- **Archive `Cratis/AI.Distribution`** — [Cratis/AI#264](https://github.com/Cratis/AI/issues/264)
  Phase 5. Point its README at the `Cratis/AI` commands, then archive.
  **Never delete the repo or its tags** (`v0.1.0`–`v0.3.0` must stay
  resolvable).

A live marketplace listing carries the same support as the supported stable
`1.0.0` release it resolves from this repository's default branch.
