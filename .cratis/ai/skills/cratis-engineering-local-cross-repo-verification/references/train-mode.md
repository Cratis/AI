<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Train mode

A local release train combines several branches into one pull request, one CI run and one
release. Verify a downstream repository against the upstream train's packages, not against
per-branch packages.

## Stamp

`stamp --train PRODUCER...` prints `X.Y.Z-train.g<sha7>`: the next patch of the highest
reachable tag and the short HEAD of the last producer. There is no minute, so one code state
always yields the same stamp and a repeat run can be compared. Every command that takes a
stamp accepts it: `pack-*`, `use-*`, `verify-*`, `check` and `clean --stamp`. A train stamp
sorts above the released pin like a local stamp does.

## Rules

- One stamp per train state. The train tool records it in the train manifest; read it from there
  instead of recomputing it for a different HEAD.
- A fold into the upstream train changes the upstream HEAD and so the stamp. Downstream
  verification against the old stamp is stale: pack again, overlay the new stamp, rebuild and
  re-verify. Do not carry a pass over a fold.
- Train versions are as local as local stamps. `check` reports `-train.g<sha7>` in changed
  tracked, staged and untracked files, so a train version never reaches a commit or pull request.
- Upstream first. The downstream ships only after the upstream has released and the downstream pin
  is bumped to the released version; run `check` (0 leaks) before the downstream push.

## Recording consumed versions

`verify-pack STAMP NAME... --json` and `verify-assets CONSUMER STAMP [--npm] --json` print one line:
`{"stamp":"...","packages":[{"id":"...","version":"..."}]}`. Findings go to stderr and the exit status
is unchanged, so a train tool can record the consumed versions without scraping text.

## Clean

`clean --stamp STAMP` lists and removes the feed files, cache folders and Yarn cache entries of
that one train stamp; a local stamp is not matched. Review the dry run before `--apply`.
