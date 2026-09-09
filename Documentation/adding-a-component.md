# Adding or changing a component

> **Audience:** Maintainers of Cratis/AI — corpus change procedure. Not required for adopting Cratis AI.

**Status:** Maintainer procedure for `Cratis/AI` itself; not an installation or support claim

Adding a skill, rule, agent, prompt, hook or host extension — or editing the bytes
of one that already exists — moves a set of reviewed digests and counts that the
validators refuse to derive for you on purpose. This page is the procedure. It
exists because the errors used to tell you *that* something moved without telling
you *what to put back*, so the number had to be recomputed by hand before the gate
could go green ([Cratis/AI#260](https://github.com/Cratis/AI/issues/260)).

## What is reviewed, and why it is not automatic

Three kinds of pinned value guard the component catalogs, and they guard different
things:

| Pin | What it covers | Where it lives |
| --- | --- | --- |
| **Canonical source digest** | the exact bytes of one canonical source path | `canonicalSources[].digest` in `catalog/components.json` |
| **Content digest** | all of one component's canonical sources together | `contentDigest` in `catalog/components.json` |
| **Semantic anchor** | every record of one catalog, as reviewed | a `const` in the owning validator |

They are deliberately not derived. A digest that recomputes itself proves only
that the file is the file; the point of pinning it is that a human read the diff
and said the new bytes are the ones intended. Treat a mismatch as a request to
re-review, not as a chore.

The **counts** are different, and used to be the worst part of this page. They are
now derived from the real inventory and compared against a single reviewed record
in `distribution/candidate-component-coverage.seals.json`
([Cratis/AI#280](https://github.com/Cratis/AI/issues/280)). A change in corpus size
edits that one file, and nothing else.

## Steps

### 1. Change the canonical bytes

Edit the canonical source only — `.ai/rules/`, `.ai/skills/`, `skills/`,
`engineering/`, `.ai/hooks/`. Never an adapter under `.github/`, `.claude/`,
`.agents/` or `.pi/agents/`; those are symlinks and path-reference files, and an
edit there is lost the next time the canonical file changes. For a genuinely new
component, add its record to `catalog/components.json` and its projections to
`catalog/component-projections.json` first.

### 2. Find out what moved

```bash
node tooling/validate-catalogs.mjs --basic
```

Every failure now names the value it wants. A digest failure names the component
and the path:

```text
- cratis-hooks: canonical source digest drift for .ai/hooks
- cratis-hooks: component content digest is stale
```

An anchor failure prints both digests and the constant to re-pin:

```text
- component semantic contract differs from the independently reviewed anchor:
  expected ac6dd78a…dbfa51c4 computed ecc7b9cb…67762d58
  — review the diff, then re-pin expectedComponentAnchor in tooling/component-catalog-validation.mjs
```

A count failure names each value and points at the one file that carries it:

```text
Component inventory differs from the reviewed seal in
distribution/candidate-component-coverage.seals.json. Read the diff, confirm the
growth is intended, then update that one file:
- componentCount: reviewed 183 but the inventory has 182
- byKind.skill: reviewed 87 but the inventory has 86
```

### 3. Recompute the digests

`digestCanonicalSource` hashes one source path (a file, or a directory tree);
`digestComponentSources` hashes the component's whole `canonicalSources` array.
Both are exported by `tooling/component-catalog-validation.mjs`:

```bash
node --input-type=module -e '
import { readFileSync } from "node:fs";
import { digestCanonicalSource, digestComponentSources }
  from "./tooling/component-catalog-validation.mjs";
const catalog = JSON.parse(readFileSync("catalog/components.json", "utf8"));
for (const component of catalog.components) {
  const drifted = component.canonicalSources.filter(
    (source) => digestCanonicalSource(".", source.path) !== source.digest);
  if (drifted.length === 0) continue;
  for (const source of drifted)
    console.log(`${component.id} ${source.path}\n  ${source.digest}\n  ${digestCanonicalSource(".", source.path)}`);
  console.log(`${component.id} contentDigest\n  ${component.contentDigest}\n  ${digestComponentSources(
    component.canonicalSources.map((source) => (
      { ...source, digest: digestCanonicalSource(".", source.path) })))}`);
}'
```

Write each new value into `catalog/components.json`. Order matters: the content
digest is computed **from** the source digests, so update the source digests
first and recompute the content digest from the updated array.

### 4. Regenerate the derived catalogs, then re-pin the anchors

```bash
node tooling/generate-component-catalogs.mjs
node tooling/validate-catalogs.mjs --basic
```

The anchors cover the whole record, including `contentDigest`, so they move
whenever a digest does. Read the printed `computed` value, confirm the diff is
what you meant, and paste it over the `expected` constant the message names.
There are five, and each error says which one it is:

| Constant | Owner |
| --- | --- |
| `expectedComponentAnchor` | `tooling/component-catalog-validation.mjs` |
| `expectedProjectionAnchor` | `tooling/component-catalog-validation.mjs` |
| `expectedProjectionHostAnchor` | `tooling/component-catalog-validation.mjs` |
| `expectedHostAdapterAnchor` | `tooling/ecosystem-artifact-validation.mjs` |
| `expectedProductAnchor` | `tooling/mcp-guidance-product-contract.mjs` |

A rule or instruction that a host projects statically also moves the three S8
anchors in `tooling/native-non-skill-projections.mjs`
(`expectedStaticComponentAnchor`, `expectedStaticProjectionAnchor`,
`expectedStaticProjectionHostAnchor`) and the projected fixture:

```bash
node --input-type=module -e '
import { writeFileSync } from "node:fs";
import { expectedNativeNonSkillProjectionTree }
  from "./tooling/native-non-skill-projections.mjs";
writeFileSync("tooling/fixtures/s8-native-non-skill-expected-tree.json",
  `${JSON.stringify(expectedNativeNonSkillProjectionTree(), null, 2)}\n`);'
node tooling/native-non-skill-projections.mjs
```

### 5. Update the seal only if the corpus changed size

Editing an existing component does not change any count. Adding or removing one
does:

```bash
node tooling/component-inventory-counts.mjs --print   # the real counts, seal ignored
node tooling/component-inventory-counts.mjs           # confirms the seal agrees
```

Copy the printed values into
`distribution/candidate-component-coverage.seals.json`. `skill-packaged-candidate`
and `skill-blocked-candidate` are deliberately not sealed — they move when a skill
is promoted from blocked to packaged without the corpus changing size, and their
total is covered by `skillDispositionCount`.

**Do not restate a count anywhere else.** A spec asserts that no consumer carries
`componentCount` as a literal, because that duplication is exactly what made every
migration conflict with every other one.

### 6. Regenerate everything, inventory last

```bash
node tooling/harness-registry.mjs
node tooling/generate-profile-catalog.mjs
node tooling/generate-catalog-v2.mjs
node tooling/generate-support.mjs
node tooling/preview-readiness.mjs
node tooling/generate-ecosystem-artifact-coverage.mjs
node tooling/generate-human-catalog.mjs
git add -A
node tooling/generate-repository-inventory.mjs   # reads the index, so it runs last
git add -A
```

## What breaks

- **`source revision bytes do not match the content digest`.** The component is a
  packaged skill whose source record pins an immutable revision in
  `catalog/v2/sources.json`, and the bytes at that revision are no longer the bytes
  on disk. This cannot be fixed in the same commit that changes the bytes — the
  revision has to exist first. Commit the content change, then rebind the
  `sourceRevision` override in `tooling/generate-catalog-v2.mjs` and its evidence
  record in `catalog/evidence.json` to the new commit, in a second commit.
- **`generated component catalog is stale`.** `catalog/v2/` was not regenerated
  after `catalog/components.json` changed. Re-run step 4.
- **`repository inventory index digest changed`.** The inventory was generated
  before the rest of the change was staged. Re-run step 6 in order.
- **A count you did not expect to move.** A rule that gains or loses a
  `generated-static` projection moves between `native-static-review-projected` and
  `native-static-unprojected` without the corpus changing size. The seal names both,
  so the diff says so.

## How it is proven

The gates below all pass, and the last one is the one that says the change is
internally consistent rather than merely syntactically valid:

```bash
.ai/hooks/scripts/validate-ai-setup.sh
node tooling/validate-catalogs.mjs --basic
node tooling/run-spec-suite.mjs --basic
node tooling/run-spec-suite.mjs --governed
git diff --exit-code -- catalog/v2 catalog/generated/human-catalog \
  distribution/artifact-matrix.json distribution/engineering-artifact-matrix.json \
  distribution/profile-catalog.json distribution/profile-subscription.schema.json \
  distribution/preview-readiness.json
```

Mutation proof, if you want to see the loop close: change one component's
`semanticName` in `catalog/components.json` and run
`node tooling/validate-catalogs.mjs --basic`. The anchor error prints the new
computed digest; pasting that digest over the constant it names makes the gate
green again; reverting the `semanticName` makes it red again with the original
digest.
