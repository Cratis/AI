# Cratis Planner

The Planner manages issues across all repositories of a GitHub organization and schedules agents -
Claude running in worker containers - to investigate and implement them.

It is an event-sourced application built on the full Cratis stack: **Chronicle** for event
sourcing, **Arc** for model-bound commands/queries and generated TypeScript proxies, and
**Cratis Components** (PrimeReact) for the frontend - structured in vertical slices, the same way
Studio is.

## Capabilities

- **Issue mirror** - open issues from every tracked repository are mirrored as events with the
  predictable key `{org}-{repo}-{issue}` (for instance `cratis-studio-256`) - title, body, labels
  and comments included, so the Planner renders the full issue. Webhooks keep the mirror current;
  a daily consolidation catches anything a missed delivery would skip.
- **Internal status** - each issue carries a Planner-only status: *None*, *Ready for development*,
  *In progress* and *For review*.
- **Ordering, grouping and instructions** - issues can be manually ordered and grouped by dragging
  one onto another; a group is only scheduled when every issue in it is ready. Issues and groups
  can carry extra instructions that travel with the agent's prompt.
- **Scheduling** - ready issues become units of work dispatched to worker containers, respecting
  each Claude account's concurrent capacity and per-plan five-hour/weekly session boundaries.
  Work a user schedules prefers their own account(s); automation draws from the pool by headroom.
- **Ad-hoc work** - a free-form prompt over selected repositories, named repository groups, or a
  whole organization - every covered repository is cloned for the agent.
- **Live console and steering** - running work streams its console into the Planner, where text
  can be sent back into the session to steer it; work can be stopped at any time.
- **Usage statistics** - per-account session windows (five-hour and weekly), tokens and reported
  cost, aggregated from what every session reports back.
- **Investigations** - issues reported by people outside the organization are automatically
  investigated by an agent (using Opus), which first tries to reproduce reported bugs, comments
  its plan on the GitHub issue and suggests the model that should implement it.
- **Alerts** - a webhook running systems report to, understanding both the Planner's own payload and
  the Discord webhook shape operational alerting already speaks. An agent investigates each alert
  with whatever operational access the deployment granted it, resolves what it can, and hands back
  the rest with its findings. Alerts can be annotated, resolved, deleted, or turned into a GitHub
  issue in one step.
- **Review flow** - completed work associates its pull request with the covered issues and marks
  them for review; accepting a pull request from the Planner merges it through the GitHub API.
- **Pull request mirror** - every pull request across tracked repositories, kept current by
  webhooks, browsable on its own page.
- **GitHub App identity** - the Planner authenticates as a GitHub App rather than a shared
  personal access token, so worker containers commit and interact with GitHub as a real,
  auditable identity.

## Documents

| Document | What it covers |
| --- | --- |
| [How it works](./how-it-works.md) | The flow from GitHub issue to merged pull request |
| [Alerts](./alerts.md) | Taking alerts from running systems and having an agent work them |
| [Configuration](./configuration.md) | Every configuration option and what it does |
| [Setting up the GitHub App](./github-app-setup.md) | Connecting the GitHub App and setting the git identity |
| [Running locally](./running-locally.md) | Running the full stack with Aspire and Docker |
| [Running in the cloud](./running-in-the-cloud.md) | Production deployment with Kubernetes |

## Repository layout

| Location | Contents |
| --- | --- |
| `Source/Planner` | The application - backend, frontend and specs in one project |
| `Source/Composition` | The Aspire AppHost for running locally |
| `Source/Claude` | The worker container image (Claude CLI + .NET 10 SDK + Node/Yarn + Docker/Kubernetes/GitHub tooling) |
| `scripts/create-github-app.sh` | Registers the Planner's GitHub App under an organization from a terminal |
| `.github/workflows/planner-build.yml` | PR build - quality gates and build artifacts |
| `.github/workflows/planner-publish.yml` | Publishes the `cratis/planner` and `cratis/planner-worker` images |
