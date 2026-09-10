# Scenario: updates and rollback

How Cratis AI guidance changes under you — and how to get back.

## Today: install from `main`

Until the first governed release, marketplace installs follow the
`Cratis/AI` default branch ([Cratis/AI#264](https://github.com/Cratis/AI/issues/264)).
Updating means reinstalling or updating the plugin; rolling back means
uninstalling. There is no version to pin yet, and the published
`@cratis/pi` npm package — the whole public bundle — is a
supported stable release:

```bash
pi install -l npm:@cratis/pi   # install / update
# rollback: reinstall the previously recorded version
```

## The published world (designed, not yet live)

The versioned flow is fully designed and validated by this repository's
tooling, but no versioned profile package has been published yet. When it is:

- Every profile carries its own exact SemVer stamp, and the release train is
  atomic — one immutable release covers every profile that changed.
- A consuming repository updates by merging a **reviewed pull request** that
  bumps the pin in `.cratis/ai.json` and the host lock files. Nothing changes
  under your feet outside a merged PR.
- **Rollback is the same operation at the previous version**: restore the old
  pin in one more reviewed PR and rerun your gates. There is no floating
  `latest` to race against — floating versions are rejected outright.
- Removing a package never touches `.cratis/PROJECT.md`, `AGENTS.md`, or your
  repository-local skills.

## When you don't need this

If you installed the plugin as a solo developer and never pinned anything,
"update" is just "update the plugin" — nothing else applies to you.

## Status

- Versioned releases: **designed, not published**. Install from `main` today.
- The `@cratis/pi` npm package ships as the supported
  `1.0.0` release.
- See [distribution and subscriptions](../ai-distribution-and-subscriptions.md)
  for the complete versioning and authority model.
