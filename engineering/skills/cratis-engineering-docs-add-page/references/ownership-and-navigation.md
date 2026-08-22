# Documentation ownership and navigation

## Ownership

Use repository evidence to confirm ownership. Typical routes are:

- Chronicle topic → `Cratis/Chronicle` documentation source;
- Arc topic → `Cratis/Arc` documentation source;
- Components topic → `Cratis/Components` documentation source;
- CLI or Fundamentals topic → the matching product repository;
- contribution policy → the organization contributing source;
- cross-product landing, adoption, governance, or AI overview → the
  hand-authored `Cratis/Documentation` site source.

Client-language setup or API behavior belongs to the owning client repository,
not a guessed translation in shared product docs.

## Generated boundaries

The Documentation site synchronizes product pages from owning repositories.
Treat synchronized product directories as outputs. Edit the source repository,
then run synchronization. Never patch the generated copy.

## Navigation

Product pages normally require the owning product ToC entry. The central site
may also map product sections into a navigation bucket. Site-level pages use the
site's hand-authored navigation configuration. Inspect current source before
changing either shape; do not rely on a remembered path.

## Verification

- source page exists;
- ToC/navigation points to the built slug;
- synchronization drops no entry;
- build and internal links pass;
- code snippets pass the owning product/client validator;
- visual QA remains a separate explicit step.
