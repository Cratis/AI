# Catalog v2 source and generated files

This README is hand-authored documentation. It is not a catalog and is not consumed as catalog data.

## Hand-authored sources

Edit these files directly:

- `authoring-contracts.json`
- `bundles.json`
- `human-catalog.json`
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

`repository-inventory.json` is also generated. Run `node tooling/generate-repository-inventory.mjs` after repository files change.

The generated JSON catalogs use schema-approved `generatedBy` fields where their closed schemas permit them. This README is the source marker for the directory; unsupported marker fields must never be added to closed catalog schemas.
