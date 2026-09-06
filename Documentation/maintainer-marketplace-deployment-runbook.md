# Maintainer runbook — standing up automatic marketplace deployment

Audience: a Cratis maintainer with owner rights. Everything here is a **manual
configuration step outside a pull request**. Engineering work is not the blocker;
each item below is an account, credential, protection, or listing that a human
has to create.

Every claim in this page is taken from the actual pipeline — the `environment:`,
`secrets.*`, `permissions:`, and `id-token:` blocks in `.github/workflows/**`,
and from `distribution/npm-stage-contract.json`,
`distribution/release-automation-capabilities.json`,
`distribution/remote-repository-state.json`, and
[the generated distribution authority state](../distribution/generated-repository-authority-request.md).
Nothing is inferred from what a deployment "usually" needs.

Read [capability catalog v2](./capability-catalog-v2.md#normalized-evidence) for
the evidence vocabulary this page uses. In short: **authored** means a human
wrote it here; **generated** means a generator produced it; **evaluated** means
an evaluation ran against it; **supported** means a support claim exists;
**unavailable** means there is no such capability. Configuration state below is
none of those — it is an observed fact about an external account or setting, and
it is labeled done or outstanding accordingly.

## Status at a glance

| # | Step | Tracked by | State |
| --- | --- | --- | --- |
| 1 | `distribution-canary` protected environment | [#181](https://github.com/Cratis/AI/issues/181) | **Done** — `CONFIGURED`, reviewer `woksin`, branch `main` |
| 2 | `npm-stage` protected environment | [#181](https://github.com/Cratis/AI/issues/181) | **Done** — `CONFIGURED`, reviewer `woksin`, branch `main` |
| 3 | npm `@cratis` scope ownership and trusted publishing | [Cratis/Workflows#70](https://github.com/Cratis/Workflows/issues/70) | **Done** for `release-passive-previews.yml` — see the caveat in step 3 |
| 4 | `Cratis/AI.Distribution` GitHub App (`AI_DISTRIBUTION_APP_ID` / `AI_DISTRIBUTION_APP_PRIVATE_KEY`) | [Cratis/Workflows#72](https://github.com/Cratis/Workflows/issues/72) | **Outstanding, and now smaller** — the App is still not installed; the public marketplace lane no longer needs it, three gated workflows still do |
| 5 | Canary repository and subscriber ring authorization | [Cratis/Workflows#71](https://github.com/Cratis/Workflows/issues/71) | **Outstanding** |
| 6 | Single-repository re-pointing (protected `distribution` branch, `dist/*` tags) | [#264](https://github.com/Cratis/AI/issues/264) Phase 2 | **Landed in code** ([#266](https://github.com/Cratis/AI/pull/266)) — two configuration items remain, both below |
| 7 | Archive `Cratis/AI.Distribution` | [#264](https://github.com/Cratis/AI/issues/264) Phase 5 | **Outstanding** — blocked on step 6 |
| 8 | Marketplace publisher accounts and vendor listing review | [#147](https://github.com/Cratis/AI/issues/147) | **Outstanding** |

Steps 4 and 6 interact, and step 6's engineering half is now done: the public
marketplace lane writes inside `Cratis/AI` with its own `contents: write` token
and needs no cross-repository App. The App is still required by the three lanes
listed in step 4, all of which are separately blocked. Do not install it for
`Cratis/AI.Distribution` unless you need one of those blocked lanes to run before
they are migrated too.

## 1 and 2 — protected environments

`distribution/remote-repository-state.json` records both environments as
`CONFIGURED` on `Cratis/AI`, restricted to `main`, with `woksin` as the required
reviewer.

| Environment | Used by | Why |
| --- | --- | --- |
| `distribution-canary` | `distribution-generated-update.yml` (`create-fixture-pr`, `create-passive-candidate-pr`), `distribution-approved-profile-release.yml`, `release-approved-ai-profiles.yml` (`distribute`) | Gates every job that mints a GitHub App token and writes outside `Cratis/AI` |
| `npm-stage` | `release-approved-ai-profiles.yml` (`publish-npm`), `release-passive-previews.yml` (publish job) | Gates the only two jobs that hold `id-token: write` |

Rules to keep when you touch them:

- restrict each environment to `main` only;
- keep `id-token: write` scoped to the publish job, never at workflow level —
  both workflows already do this and `tooling/specs/workflow-safety.spec.mjs`
  asserts it;
- `distribution/npm-stage-contract.json` records
  `environmentApprovalRequired: false` for `npm-stage`. If you add a required
  reviewer there, update that field in the same change so the contract stops
  disagreeing with reality.

**Step 6's code has landed**, so the same protection posture is now owed to the
new generated branch: branch protection on `distribution` with force-push and
deletion disabled and no human push path, and tag protection on `dist/*` so a
release tag is immutable. Apply it the same way — by hand, through the API — and
record it alongside these two environments. Step 6a below is that item.

The `publish` job of `distribution-public-marketplace.yml` runs in
`distribution-canary`, so the same reviewer already gates every write to the
protected branch, the `dist/*` tag, and the GitHub release.

## 3 — npm trusted publishing

Tracked by [Cratis/Workflows#70](https://github.com/Cratis/Workflows/issues/70).
`distribution/npm-stage-contract.json` records the completed setup:

- `@cratis` scope ownership and public registry status verified on 2026-08-27 by
  `woksin.sindre`;
- the `0.0.0-bootstrap.0` placeholder is published and deprecated, with registry
  readback verified;
- an npm trusted publisher is configured for provider `github-actions`,
  organization `Cratis`, repository `AI`, workflow **`release-passive-previews.yml`**,
  environment `npm-stage`, operation `npm publish`;
- `latestTagPolicy` is `stable-or-deprecated-bootstrap-never-preview`.

**Caveat you must handle.** npm trusted publishing binds the **exact workflow
filename**. `release-passive-previews.yml` carries a comment saying its filename
is retained for precisely this reason. But `release-approved-ai-profiles.yml`
also runs `npm publish --provenance` from the `npm-stage` environment. Before
the governed release lane can publish, either register a second trusted
publisher for `release-approved-ai-profiles.yml` or move the publish step into
the already-registered workflow. Renaming either file breaks publishing.

The publish job also requires npm **11.5.1 or newer** (asserted at runtime) and
Node 24 in the workflow.

## 4 — the `Cratis/AI.Distribution` GitHub App

Tracked by [Cratis/Workflows#72](https://github.com/Cratis/Workflows/issues/72).
**Not installed.** Three workflows mint a token from it and cannot run without
it:

| Workflow | Job |
| --- | --- |
| `distribution-generated-update.yml` | `create-fixture-pr`, `create-passive-candidate-pr` |
| `distribution-approved-profile-release.yml` | the distribution job |
| `release-approved-ai-profiles.yml` | `distribute` |

Each calls `actions/create-github-app-token` with exactly:

- `owner: Cratis`
- `repositories: AI.Distribution`
- `permission-contents: write`
- `permission-pull-requests: write`

Those four lines are the complete required scope. Do not grant more. The
installation token is short-lived and is revoked at job completion; the App has
no standing credential, cannot push to `main`, cannot tag or release, cannot
publish to npm, and cannot submit a marketplace package.

Both secrets live in `Cratis/AI` Actions secrets:
`AI_DISTRIBUTION_APP_ID` and `AI_DISTRIBUTION_APP_PRIVATE_KEY`.

`distribution-public-marketplace.yml` **no longer appears in that table.** Since
[#266](https://github.com/Cratis/AI/pull/266) it reads and writes only
`Cratis/AI`: it checks out `Cratis/AI@distribution` read-only with
`persist-credentials: false` in its `stage` job, and its `publish` job writes the
protected branch, the `dist/vX.Y.Z` tag, and the GitHub release with the
workflow's own `${{ github.token }}` under job-scoped `contents: write`. It
references neither secret.

**Read this before installing the App.** Step 6 removes the rest of this item
too, once the three remaining lanes are migrated. Install the App only if you
need one of those blocked two-repository lanes to work before that happens.

## 5 — canary and subscriber authorization

Tracked by [Cratis/Workflows#71](https://github.com/Cratis/Workflows/issues/71).
**Outstanding.**

`release-approved-ai-profiles.yml` runs a `canary` job before `distribute`, and
checks out `Cratis/Samples` as the canary consumer.
`distribution/release-automation-capabilities.json` records
`autoRollback: false` and `subscriberUpdates: false`, with subscriber updates
"Disabled until Cratis/Workflows#73 is implemented and canaried."

A maintainer must authorize:

- the canary consumer repository, so a real install/update/rollback/uninstall
  lifecycle can run against a published version;
- the subscriber ring that later receives reviewed update pull requests.

Until this exists, no release can produce real host lifecycle evidence, so no
profile can leave the basic assurance lane
([`distribution/assurance-lanes.json`](../distribution/assurance-lanes.json)).

## 6 — single-repository re-pointing (Phase 2 of #264)

**The engineering work has landed in [#266](https://github.com/Cratis/AI/pull/266).**
Two items remain, and neither can be done from a pull request.

### 6a — create and protect the branch (repository admin, out of band)

This is a manual configuration step exactly like steps 1 and 2: a human with
owner rights applies it through the GitHub API, and no workflow ever creates or
protects the branch.

1. Create the orphan `distribution` branch in `Cratis/AI`.
2. Protect it: force-push disabled, deletion disabled, administrators included,
   and no human push path. Only the release workflow may write it.
3. Add tag protection for `dist/*` so a release tag is immutable once created.
4. Confirm the `Cratis/AI` Actions token may create releases and tags.

Record the observed settings in
[`distribution/remote-repository-state.json`](../distribution/remote-repository-state.json)
under `supersedingDecision.phase2Execution.appliedOutOfBandByRepositoryAdmin`
once they exist, the same way this page records steps 1 and 2 as `CONFIGURED`.

The staging workflow tolerates the branch not existing yet: it probes for the ref
and, on a bootstrap run, stages a complete tree with no carried-forward
candidates and runs the rollback simulation against the staged tree itself. So
step 6a can be done before or after the first dispatch, but the branch must exist
and be protected before anyone trusts what lands on it.

### 6b — run the re-pointed workflow once for real

Dispatch **Stage Public Marketplace Distribution**. One run now:

1. reads `Cratis/AI@distribution` as the current generated state;
2. stages the complete tree and runs all seven required checks against it;
3. pushes it to `refs/heads/distribution` and creates `dist/vX.Y.Z`;
4. re-runs all seven checks against the published branch;
5. publishes the GitHub release at that tag with `SHA256SUMS`,
   `provenance.json`, `distribution-manifest.json`, `marketplace-release.json`,
   and the vendor-portal handoff archives; and
6. opens a `no-release` pull request adding the four thin pointer marketplace
   manifests to `main`.

Then re-run the host install evidence at the new ref for Claude Code, Codex,
Copilot, Gemini, Pi, Cursor, and Kiro, and record it under
`distribution/evidence/` in the existing format — including the negative test
that adding `Cratis/AI` as a marketplace does **not** surface the authored root
`skills/` tree.

### What already landed in code

- `distribution-public-marketplace.yml` reads `Cratis/AI@distribution`, stages,
  verifies, pushes, tags, re-verifies, releases, and opens the pointer pull
  request. Generation and verification stay in a read-only `stage` job;
  `contents: write` and `pull-requests: write` are scoped to the `publish` job,
  which is gated by the `distribution-canary` environment.
- `.github/workflows/verify-distribution-branch.yml` is a live control plane in
  `Cratis/AI` running all seven required checks — `exact-inventory`,
  `canonical-byte-parity`, `native-manifest-parse`, `checksums`,
  `fixture-provenance-record`, `pack-install-smoke-uninstall`,
  `canary-rollback-simulation` — against the protected branch. The reviewed
  source under `distribution/repository-control-plane/` is unchanged and still
  mirrors into the generated tree.
- `tooling/generate-marketplace-pointer-manifests.mjs` emits the four pointer
  manifests, and **not** `gemini-extension.json`, root `plugin.json`, or root
  `package.json`, so no host discovers the authored root `skills/` tree.
- `distribution/marketplace-requirements.json` records the `Cratis/AI` install,
  update, and uninstall commands; the host preflights under
  `distribution/evidence/s9-*` still need re-running at the new ref as part of
  step 6b.

### What was deliberately not re-pointed

`release-approved-ai-profiles.yml`, `distribution-approved-profile-release.yml`,
and `distribution-generated-update.yml` still target `Cratis/AI.Distribution`.
They do not merely name a repository: each one clones it, replaces its root with
`rsync --delete`, and opens, merges, or releases against its default branch. A
name-only re-point would aim that shape at the `Cratis/AI` authoring surface,
which is the exact outcome the ref-and-subtree boundary exists to prevent. All
three are separately blocked today — by the S10 policy, by a hard-disabled
activation job, and by the uninstalled App respectively — so leaving them
coherent and inert is safer than leaving them half-migrated. Migrate them
together with whatever unblocks them.

## 7 — archive `Cratis/AI.Distribution` (Phase 5 of #264)

**Outstanding, blocked on step 6.**

- Keep the repository alive as a CI-published mirror first, so the published
  `v0.1.0` through `v0.3.0` install commands keep working.
- Update the mirror's `README.md` to point at the `Cratis/AI` install commands.
- Archive only once no current documentation, listing, or subscription references
  it, and only while its tags stay resolvable for the evidence records under
  `distribution/evidence/` that cite them.
- **Never delete the repository or its tags.**
- Close out the `Cratis/AI.Distribution` half of Cratis/Workflows#72 as no longer
  required, and obtain owner sign-off that consolidation supersedes the
  `Cratis/Strategy#126` repository registration.

## 8 — marketplace publisher accounts and vendor listings

Tracked by [Cratis/AI#147](https://github.com/Cratis/AI/issues/147).
**Outstanding.** `distribution/release-automation-capabilities.json` records
`marketplaces: "manual-handoff"`, and the recovery note says the publisher
account and vendor review handoff remains #147's.

`tooling/package-public-marketplace-submissions.mjs` builds a vendor-portal
handoff bundle, and
[`distribution/generated-repository-contract.json`](../distribution/generated-repository-contract.json)
splits the hosts:

- **self-hosted channels** need no vendor account — `agent-skills`,
  `agent-plugin`, `claude-code`, `github-copilot`, `gemini-cli`, `kiro`,
  `pi-git-package`. These install from a ref you control.
- **vendor portal handoffs** need an owner-authenticated publisher account and a
  review submission — `openai-skills-only-plugin` and `cursor-agent-plugin`. The
  packages are prepared release assets today; the submission is manual.

`distribution/marketplace-publications.json` is still `{"publications": []}` with
`defaultPolicy: "deny"`. Record a publication there only after a listing is
actually live; the file is the claim, and an empty list is the honest state.

Marketplace listing is orthogonal to technical support. A live listing never
implies behavior support, broad-rollout approval, or a stable support claim.

## Order to work in

1. Step 6a, then 6b — the code is already there, so this is now the shortest path
   to a `Cratis/AI`-hosted release, and it keeps deleting step 4's remaining
   work.
2. Step 5, so a release can produce real lifecycle evidence.
3. Step 3's second trusted publisher, so the governed release lane can publish.
4. Step 7, once nothing live cites the mirror.
5. Step 8 last, because a vendor listing should point at a ref that is already
   stable.
