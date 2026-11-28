# Select the release label

Use exactly one of `major`, `minor`, `patch` or `no-release`. Use `no-release` only for changes with no release impact. Do not generalize an automated Dependabot exemption to ordinary PRs.

## Issue references

With release-action, end a bullet with `(#n)` only for a verified issue that the change fully delivers and is authorized to close. Use `(part of #n)` for partial delivery, `see #n` for related work, and no reference when there is no issue. Never substitute the PR number for the issue number.

## Cratis/AI corpus changes

Installed skills, rules, prompts and hooks are part of the product, not internal documentation. Use `patch` to correct existing guidance, `minor` for new guidance or a new required step, and `no-release` for tests, evaluations or CI changes that consumers do not see.
