# Describe the delivery

Use the repository’s PR template. Put verification and reviewer instructions in a comment when the body becomes release notes. Follow the [issue reference policy](pr-labels-and-release.md#issue-references) and name what remains for a partially delivered issue.

## Keep the release note true to the diff

After integrating the base and before every body edit, run `git diff --stat origin/main...HEAD`, substituting the current target ref for `origin/main` when it differs. Inspect the affected hunks and drop bullets for work already on the base through another PR or dropped during conflict resolution. Confirm each named version, package and registry against the diff and the current publishing workflow; do not name a registry it does not publish to.

In repositories that opt into the Cratis PR policy, save the draft as `pr-body.md` in the ignored scratch directory. From the repository root, run:

```bash
node .cratis/ai/hooks/scripts/cratis-check-pr.mjs --body-file "$body" --label "$intent"
```

Set `body` to the draft's path and `intent` to the chosen release label. For a non-default target, supply the branch name with `--base`. Require a passing check before submitting the body. If the checker rejects the description, fix the description, not the implementation.
