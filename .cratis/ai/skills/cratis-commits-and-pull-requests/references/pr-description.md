# Describe the delivery

Use the repository's PR template. Where the PR body supplies the published release notes, use only applicable `Added`, `Changed`, `Fixed`, `Removed`, `Security` and `Deprecated` sections with short, user-facing bullets. Include migration guidance for breaking changes. Put verification, test and CI results and other reviewer context in a PR comment, not in the body. Do not narrate the work in the release note.

## Issue references

If `cratis/release-action` closes issues from the notes, end the delivering bullet with `(#n)` only for a verified issue this PR fully delivers and is authorized to close. Use one reference per issue (`(#1) (#2)`), never the PR number. Use `(part of #n)` for partial delivery and say what remains. Use `see #n` for related work, and omit the reference when there is no issue. Do not prefix issue numbers with linking or closing keywords. Where a different publisher is in use, follow the repository's issue-closing process.

## Keep the release note true to the diff

After integrating the base and before every body edit, run `git diff --stat origin/main...HEAD`, substituting the current target ref for `origin/main` when it differs. Inspect the affected hunks and drop bullets for work already on the base through another PR or dropped during conflict resolution. Confirm each named version, package and registry against the diff and the current publishing workflow; do not name a registry it does not publish to.

Run the repository’s PR policy check if supplied. In repositories that opt into the Cratis PR policy, save the draft as `pr-body.md` in the ignored scratch directory. From the repository root, run:

```bash
node .cratis/ai/hooks/scripts/cratis-check-pr.mjs --body-file "$body" --label "$intent"
```

Set `body` to the draft's path and `intent` to the chosen release label. For a non-default target, supply the branch name with `--base`. Require a passing check before submitting the body. If the checker rejects the description, fix the description, not the implementation.
