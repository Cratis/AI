# Select the release label

In repositories using Cratis release labels, choose exactly one: `major` for a breaking contract, `minor` for a compatible capability, `patch` for a compatible fix, or `no-release` for changes with no consumer release impact. Do not generalize an automated Dependabot exemption to ordinary PRs. Follow the [description policy](pr-description.md) for release-note content and issue references.

## Cratis/AI corpus changes

Installed skills, rules, prompts and hooks are part of the product, not internal documentation. Use `patch` to correct existing guidance, `minor` for new guidance or a new required step, and `no-release` for tests, evaluations or CI changes that consumers do not see.
