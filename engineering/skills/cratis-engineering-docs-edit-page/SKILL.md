---
name: cratis-engineering-docs-edit-page
description: Locate and change the authoritative source of an existing Cratis documentation page, then sync and verify it. Use for corrections, rewording, broken links, and outdated examples; route new pages, fresh content design, and visual QA to their focused companion workflows.
license: LICENSE
---

# Edit a Cratis documentation page

Change an existing page in the repository that owns its source. This skill owns
**source discovery and integration of an edit**. It does not create a new page,
invent product facts, or perform visual QA.

## Required inputs

Establish:

- the published URL or a distinctive passage;
- the intended correction;
- the owning product/client or site-level subject;
- authoritative product source for every changed technical claim;
- the owning repository's documentation gates.

## Route near misses

- The requested page does not exist: defer to
  `cratis-engineering-docs-add-page`.
- The content needs a new document-type design or substantial fresh draft:
  defer that content to `cratis-engineering-docs-authoring`.
- The request is to inspect rendered appearance or layout shift: defer to
  `cratis-engineering-docs-visual-qa`.
- The subject is not Cratis documentation: do not apply this skill.
- The correction depends on unverified product/API behavior: block the claim and
  identify the owning first-party source.

## Source discovery

1. Map product URLs to the owning product or client repository.
2. Map cross-product/site-level URLs to the hand-authored Documentation site.
3. Search owning sources by slug, title, or distinctive passage when mapping is
   uncertain.
4. Reject generated/synchronized product pages as edit targets.
5. Confirm the exact source path and proposed change before modifying bytes.

Read [source-discovery.md](references/source-discovery.md) for the boundary.

## Editing workflow

1. Read the page and preserve its document type and established voice.
2. Verify every changed API, command, version, link destination, or support claim
   against first-party source.
3. Ask for confirmation of the exact modified paths.
4. Make the smallest coherent correction in the owning source.
5. Update navigation only when the title or slug change requires it.
6. Synchronize product content into the site; never edit synchronized output.
7. Run the owning snippet/build/lint/link gates and the site build when the page
   is public.
8. Report source checked, changed paths, verification, and visual QA still
   required.

## Safety boundary

Never overwrite project context, credentials, generated code, package manifests,
or unrelated docs. Never copy private implementation or Strategy content into a
public page. Do not commit, push, publish, or deploy from this skill.

## Completion

The authoritative source contains the correction, generated copies are produced
only by synchronization, technical claims are source-backed, links resolve, and
all applicable documentation gates pass.
