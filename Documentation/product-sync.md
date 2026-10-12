<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Keep the corpus aligned with product releases

`.cratis/ai/product-sync.json` records each Cratis product's sync floor and the
skills and rules that cover it. Initial floors use the oldest retained source
verification in those skills, not the latest release or a dependency range.
They are inventory baselines, not a promise that every newer API exists at that
version. Initial dates record when the inventory was captured; notes preserve
that distinction. `synced: null` means no released sync baseline is established.

## Decide coverage

`coverage` is optional and defaults to `"tracked"`. Tracked products participate
in release comparisons, even when their first coverage is still being added.
If both `covers.skills` and `covers.rules` are empty, `synced` must be null and
`notes` must say **"Coverage is planned"** ("Coverage planned" also works).
Add the real coverage targets when that work lands; do not invent a sync version.
Architecture's analyzer coverage lives in `rules/csharp.md`.

Use `"coverage": "not-covered"` only for a deliberate decision not to teach the
product in this corpus. It requires a non-empty `notes` reason, empty skill and
rule coverage, and `synced: null`. These products are listed under **Not covered
(by decision)**, with their reasons, instead of appearing as permanent drift.
Verification enforces these coupled fields; an excluded product cannot satisfy
a verified-source skill's coverage requirement.

Set `"visibility": "private"` for private repositories; omit it for public
repositories. Verification rejects other values. A private product that returns
HTTP 403 or 404 is listed as **Not checked (private repository, no access)**,
not as current or drifted. Accessible private products are compared normally;
other failures, including every public-product read failure, still fail the report.

Set `"track": "prerelease"` for products that publish only GitHub pre-releases.
This compares against the latest non-draft release, including pre-releases,
rather than a moving default-branch commit. Omit it to track stable releases;
verification rejects other values.

## Sync a product

1. Read the product's releases since `synced.version`. If it is null, establish
   the first baseline from released source evidence rather than guessing.
2. Check the covered skills and rules against the new tag. Update changed APIs,
   examples, limitations, and verification evidence. Keep historical runtime
   probes distinct from new source reads.
3. Move `synced.version`, `synced.date` (UTC `YYYY-MM-DD`), and `synced.by`
   (an issue or PR reference such as `Cratis/AI#619`) in the **same change**.
   Omit the leading `v` from release tags. For a product without releases, use
   `main@<sha7>` for the inspected default-branch commit.
4. Run `yarn workspace @cratis/ai-verification run verify` and the repository's
   relevant tests. Verification rejects missing coverage targets, uncovered
   verified-source skills, duplicate products, invalid dates and versions, and
   an empty ledger. It prints the product and coverage counts.

The ledger does not replace the dependency pin tables or overwrite historical
provenance. Raising a whole-product floor needs evidence for its covered scope.

## Check drift

Install workspace dependencies and authenticate the GitHub CLI, then run from
this repository:

```sh
yarn workspace @cratis/ai-verification run drift
yarn workspace @cratis/ai-verification run drift --json
```

The report compares each tracked floor with GitHub's latest non-prerelease
release, or the latest non-draft release including pre-releases when
`track` is `"prerelease"`. Decided not-covered products do not trigger release lookups and never
count as drift; the JSON report lists them in `notCovered`, separately from
`rows` and the compared `products` count. Inaccessible private products appear
in `notChecked` and are also excluded from that count. For an accessible tracked repository
with no releases, it compares the default-branch commit. A never-synced tracked
product, including one whose coverage is planned, always needs attention. Release counts come from
one page of up to 100 releases; `unknown` means the endpoints could not both be
counted, not that no releases intervened. The report lists covered skills.

| Exit | Meaning |
| --- | --- |
| `0` | No compared product has drifted; check `notChecked` for inaccessible private products. |
| `1` | At least one compared product has drifted; private products may also be not checked. |
| `2` | The report could not run completely: invalid ledger, missing CLI, authentication, network, or response failure. |

`drift --self-test` checks planted violations without network access.

The weekly **Product drift** workflow (also available through
`workflow_dispatch`) creates or updates one open issue titled **AI corpus
product drift**, labelled `product-drift`, with the report table and the same
**Not covered (by decision)** and **Not checked (private repository, no access)**
sections. When tracked drift reaches zero and no private products remain not
checked, it refreshes the body, comments, and closes that issue. Otherwise the
issue stays open, including when inaccessible private products are the only
outstanding checks. Other unreadable tracked products fail the job.

The drift step uses the optional `PRODUCT_DRIFT_TOKEN` secret, falling back to
`github.token`. A fine-grained, read-only token with **Metadata: read** and
**Contents: read** on the private product repositories enables their checks.
Nothing else needs that token: issue reconciliation uses `github.token`, with
repository permissions limited to contents read and issues write.
