# Marketplace Release Setup

This page describes what must be configured before publishing `cratis` plugin artifacts to marketplaces.

## Current workflow behavior

The workflow at `.github/workflows/publish.yml` currently:

1. Runs the repository standard release flow using `cratis/release-action@v1` to determine the release version and whether publishing should happen
2. Validates plugin manifests
3. Builds `cratis-plugin.tgz` and `cratis-plugin.zip`
4. Uploads both files as workflow artifacts
5. Attaches both files (and marketplace metadata) to the generated GitHub release tag (`v<version>`)
6. Publishes to the VS Code Copilot marketplace endpoint
7. Publishes to the Claude marketplace endpoint

## Credentials needed for marketplace publishing

Marketplace publication requires separate credentials and publish endpoints per marketplace. Store these as **GitHub Actions repository secrets**:

- Repository secrets UI: https://github.com/Cratis/AI/settings/secrets/actions
- GitHub docs for Actions secrets: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions

### VS Code Copilot marketplace

Configure:

- `COPILOT_MARKETPLACE_PUBLISH_URL` - The marketplace publish API endpoint URL
- `COPILOT_MARKETPLACE_TOKEN` - The token for that endpoint

The publish workflow sends `cratis-plugin.tgz` with a multipart request (`plugin` + `version` fields) to this endpoint.

- Publishing guide: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- Create/manage PAT: https://learn.microsoft.com/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate

### Claude plugin marketplace

Configure:

- `CLAUDE_MARKETPLACE_PUBLISH_URL` - The marketplace publish API endpoint URL
- `CLAUDE_MARKETPLACE_TOKEN` - The token for that endpoint

The publish workflow sends `cratis-plugin.zip` with a multipart request (`plugin` + `version` fields) to this endpoint.

- Claude Code plugins documentation: https://docs.anthropic.com/en/docs/claude-code/plugins

## Recommended release checklist

1. Ensure plugin names are `cratis` in:
   - `plugin.json`
   - `.claude-plugin/plugin.json`
   - `.claude-plugin/marketplace.json`
2. Create/rotate marketplace credentials
3. Store credentials in repository secrets
4. Trigger the publish workflow (manual or merged PR flow) and confirm release assets are attached
5. Confirm both marketplace publish calls succeed
