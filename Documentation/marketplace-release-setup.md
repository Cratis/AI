# Marketplace Release Setup

This page describes what must be configured before publishing `cratis` plugin artifacts to marketplaces.

## Current workflow behavior

The workflow at `.github/workflows/publish.yml` currently:

1. Validates plugin manifests
2. Builds `cratis-plugin.tgz` and `cratis-plugin.zip`
3. Uploads both files as workflow artifacts
4. Attaches both files to the published GitHub release

No additional token is required for these steps beyond the repository-provided `GITHUB_TOKEN`.

## Credentials needed for marketplace publishing

Marketplace publication requires separate credentials per marketplace. Store these as **GitHub Actions repository secrets**:

- Repository secrets UI: https://github.com/Cratis/AI/settings/secrets/actions
- GitHub docs for Actions secrets: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions

### VS Code Marketplace / Visual Studio Marketplace

If you automate publishing there, create a publisher and Personal Access Token (PAT), then save it as a repository secret (for example `VSCE_PAT`).

- Publishing guide: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- Create/manage PAT: https://learn.microsoft.com/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate

### Claude plugin marketplace

If you automate publishing there, create the marketplace/publisher token in the Claude platform and store it as a repository secret (for example `CLAUDE_MARKETPLACE_TOKEN`).

- Claude Code plugins documentation: https://docs.anthropic.com/en/docs/claude-code/plugins

## Recommended release checklist

1. Ensure plugin names are `cratis` in:
   - `plugin.json`
   - `.claude-plugin/plugin.json`
   - `.claude-plugin/marketplace.json`
2. Create/rotate marketplace credentials
3. Store credentials in repository secrets
4. Publish a GitHub release and confirm artifacts are attached
5. Publish to each marketplace using its official publish flow
