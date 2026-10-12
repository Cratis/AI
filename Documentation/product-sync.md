<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Keep the corpus aligned with product releases

`.cratis/ai/product-sync.json` records each Cratis product's sync floor and the
skills and rules that cover it. Initial floors use the oldest retained source
verification in those skills, not the latest release or a dependency range.
They are inventory baselines, not a promise that every newer API exists at that
version. Initial dates record when the inventory was captured; notes preserve
that distinction. `synced: null` means no released sync baseline is established.

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

The report compares each floor with GitHub's latest non-prerelease release. For
an accessible repository with no releases, it compares the default-branch
commit. A never-synced product always needs attention. Release counts come from
one page of up to 100 releases; `unknown` means the endpoints could not both be
counted, not that no releases intervened. The report lists covered skills.

| Exit | Meaning |
| --- | --- |
| `0` | All products were read and none has drifted. |
| `1` | All products were read and at least one has drifted. |
| `2` | The report could not run completely: invalid ledger, missing CLI, authentication, network, or response failure. |

`drift --self-test` checks planted violations without network access.

The weekly **Product drift** workflow (also available through
`workflow_dispatch`) creates or updates one open issue titled **AI corpus
product drift**, labelled `product-drift`, with the report table. When drift
reaches zero, it comments and closes that issue. Unreadable products fail the
job; they never close the issue as if the corpus were current.
