---
name: cratis-engineering-docs-add-page
description: Place and wire a new Cratis documentation page after its product, audience, document type, and authoritative source are known. Use when the page does not exist; route existing-page edits, content drafting, and visual QA to their focused companion workflows.
license: LICENSE
---

# Add a Cratis documentation page

Place one new page in the repository that owns its subject and wire it into the
published Cratis documentation navigation. This skill owns **placement and
integration**. It does not invent product content, edit an existing page, or
perform visual QA.

## Required inputs

Establish before changing files:

- Cratis product or cross-product subject;
- owning repository;
- approved destination and document type;
- page title and navigation label;
- authoritative product source for factual content;
- whether the page is product-owned or site-level.

If ownership or destination cannot be established from repository evidence,
stop and return the unresolved decision instead of guessing.

## Route near misses

- The page already exists: defer to `cratis-engineering-docs-edit-page`.
- Placement is approved but content is not drafted: defer content to
  `cratis-engineering-docs-authoring`.
- The request is to render or screenshot a page: defer to
  `cratis-engineering-docs-visual-qa`.
- The subject is not Cratis documentation: do not apply this skill.
- Product/API authority is missing: block factual drafting and identify the
  owning source needed.

## Placement workflow

1. Confirm the page does not already exist in the owning source repository.
2. Choose the source root:
   - product/client/contributor page: that repository's `Documentation/` tree;
   - cross-product or site-level page: the `Cratis/Documentation` site's
     hand-authored content tree.
3. Confirm the document type and approved filename before creating it.
4. Ask for confirmation of the exact new and modified paths.
5. Create the source page using the approved content or invoke
   `cratis-engineering-docs-authoring` for the draft.
6. Wire the owning navigation source. For product docs, update the product ToC
   and the site synchronization bucket only when the current Documentation
   source proves both are required. For site-level pages, update the site's
   hand-authored navigation.
7. Run source sync and verify that no navigation entries were dropped.
8. Run the owning repository's build, snippet, lint, and link gates.
9. Report the created page, navigation changes, authority checked, and visual QA
   still required.

Read [ownership-and-navigation.md](references/ownership-and-navigation.md) for
the placement boundary.

## Safety boundary

Never edit synchronized/generated product pages in the Documentation site. Never
copy private product or Strategy material into public docs. Do not change project
context, credentials, package manifests, unrelated pages, or distribution
metadata. Do not commit, push, publish, or deploy from this skill.

## Completion

The page exists in its owning source repository, navigation resolves to the
built page, sync reports no dropped entry for it, repository documentation gates
pass, and remaining content or visual review is explicit.
