# Catalog v2 source and generated files

This README is hand-authored documentation. It is not a catalog and is not consumed as catalog data.

## Hand-authored sources

Edit these files directly:

- `../evidence.json` — reusable evidence sources, exact observations, legacy facts and gaps, and distribution evidence-file inventory
- `../support-policy.json` — authored `asOf`, monotonic tier rules, evidence classes, assurance gates, and marketplace policy
- `authoring-contracts.json`
- `bundles.json`
- `human-catalog.json`
- `ecosystem-contracts.json`
- `artifact-assurance-profiles.json`
- `source-contracts.json`
- `taxonomy.json`
- `upstream-companions.json`

## Generated catalogs

Do not edit these files directly. Run `node tooling/generate-catalog-v2.mjs`:

- `artifacts.json`
- `evidence.json`
- `migrations.json`
- `product-coverage.json`
- `sources.json`
- `targets.json`

`support.json` is generated from `../evidence.json`, `../support-policy.json`, `ecosystem-artifact-coverage.json` inputs, `artifact-assurance-profiles.json`, and `distribution/ecosystem-artifact-bindings.json`. Run `node tooling/generate-support.mjs` after the v2 catalog generator and before the coverage or human-catalog generators. It computes technical tier, active/expired/future evidence, missing assurances, decay, marketplace status, and the support claim. It never reads the wall clock, locale, network, environment, or filesystem timestamps.

`ecosystem-artifact-coverage.json` is generated from the authored ecosystem contracts, assurance profiles, and `distribution/ecosystem-artifact-bindings.json`. Run `node tooling/generate-ecosystem-artifact-coverage.mjs`. A coverage record means the ecosystem is accounted for; it is not a support, publication, runtime, or promotion claim.

`repository-inventory.json` is also generated. Run `node tooling/generate-repository-inventory.mjs` after repository files change.

The generated JSON catalogs use schema-approved `generatedBy` fields where their closed schemas permit them. This README is the source marker for the directory; unsupported marker fields must never be added to closed catalog schemas.
