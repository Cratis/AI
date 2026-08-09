# Setting up the GitHub App

The Planner authenticates with GitHub as a **GitHub App** rather than a shared personal access
token. That's what lets worker containers commit and open pull requests as a real, auditable
identity - and what the Planner uses for every GitHub REST call (listing repositories, mirroring
issues, merging pull requests, checking organization membership) and for verifying webhook
deliveries.

## Connect the App

1. Open the Planner and go to **GitHub** in the sidebar.
2. Click **Connect GitHub App**. This is a full page navigation (not an in-app action) - GitHub's
   manifest-flow registration needs a real redirect - to `/github-app/start`, which submits a
   generated App manifest to GitHub on your behalf.
3. Review and confirm on GitHub. You'll land back on the Planner at `/github-app/created`, which
   displays the App's credentials:

   ```text
   Planner__GitHubApp__AppId=...
   Planner__GitHubApp__Slug=...
   Planner__GitHubApp__Name=...
   Planner__GitHubApp__WebhookSecret=...
   Planner__GitHubApp__PrivateKeyPem=...
   ```

4. Set these as configuration - environment variables, `dotnet user-secrets` locally, or a
   Kubernetes secret in production (see [Configuration](./configuration.md) and
   [Running in the cloud](./running-in-the-cloud.md)) - then restart the Planner. Credentials are
   shown once; if you lose them, delete the App on GitHub and register a new one.

The manifest requests exactly what the Planner needs and nothing more:

| Permission | Access | Used for |
| --- | --- | --- |
| Contents | Read & write | Cloning and pushing from worker containers |
| Issues | Read & write | Mirroring issues and comments |
| Pull requests | Read & write | Mirroring and merging pull requests |
| Metadata | Read | Baseline repository access (required by every GitHub App) |
| Members | Read | Checking organization membership for external-issue investigation |

| Webhook event | Used for |
| --- | --- |
| `issues`, `issue_comment` | Keeping the issue mirror current |
| `pull_request` | Keeping the pull request mirror current |
| `repository` | Auto-tracking new repositories created in the organization |

The Planner also handles `installation` deliveries, which record when the App is installed on or
removed from an account. That event is **not** in the manifest: GitHub delivers the installation
lifecycle events to every App implicitly and rejects a manifest that asks for them, with
`Default events unsupported: installation`.

## Install the App on an organization

Once the App is configured (the status card shows **Configured**), click **Install on an
organization**. This opens GitHub's own installation picker - choose the organization (or account)
and which repositories the App can access. GitHub redirects back to `/github-app/installed`, which
records the installation; it appears immediately under **Installations** on the same page.

The Planner supports the App being installed on more than one account - when authenticating a
GitHub API call or a worker's `GITHUB_TOKEN`, it picks the installation matching the repository's
owner, falling back to the only installation when there's just one.

Uninstalling is symmetric: remove the App from an account on GitHub, and the Planner drops that
installation (via the `installation` webhook) the next time GitHub delivers it.

## Set the git identity

Below the App connection, **Git identity** sets the `git config user.name` / `user.email` every
worker container commits as - one identity shared by the whole deployment, injected as
`PLANNER_GIT_USER_NAME` / `PLANNER_GIT_USER_EMAIL`. A GitHub App's conventional bot identity looks
like `your-app-slug[bot]` / `<app-id>+your-app-slug[bot]@users.noreply.github.com`, but any name
and email work - set whatever you want commits attributed to.

## Local development

The manifest flow's callbacks (`/github-app/created`, `/github-app/installed`) and the webhook
delivery endpoint (`/webhooks/github`) all need to be reachable from GitHub, which can't reach
`localhost` directly - see [Running locally](./running-locally.md#webhooks-locally) for tunneling
with `ngrok`, `smee.io`, or `gh webhook forward`.

## See also

- [Configuration](./configuration.md) - the full `Planner:GitHubApp` settings reference.
- [Running in the cloud](./running-in-the-cloud.md) - injecting these credentials as Kubernetes secrets.
