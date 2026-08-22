# Documentation source discovery

## Typical URL ownership

- `/chronicle/**` → Chronicle documentation source;
- `/arc/**` → Arc documentation source;
- `/components/**` → Components documentation source;
- `/cli/**` and `/fundamentals/**` → matching product source;
- `/contributing/**` → organization contributing source;
- cross-product landings and site-level pages → hand-authored Documentation site
  source.

A client-specific API or setup page belongs to its client repository even when
the published site presents it beside shared Chronicle content.

## Generated pages

Product folders under the Documentation site's generated content root are
outputs. Search the owning product repository and edit there. A generated copy
may be inspected to map a URL, but must never be the committed source change.

## Search strategy

1. derive the likely owner from the URL;
2. search the owner's documentation tree by slug/title;
3. search a distinctive sentence when names differ;
4. confirm the owning ToC or sync configuration;
5. stop and report ambiguity when more than one authoritative source remains.

## Verification

Run the owning repository's snippet and documentation checks, synchronize into
the site, build, and run internal links. Visual review is separate.
