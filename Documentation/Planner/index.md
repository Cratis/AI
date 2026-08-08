# Cratis Planner

The Planner manages issues across all repositories of a GitHub organization and schedules agents -
Claude running in worker containers - to investigate and implement them.

It is an event-sourced application built on the full Cratis stack: **Chronicle** for event
sourcing, **Arc** for model-bound commands/queries and generated TypeScript proxies, and
**Cratis Components** (PrimeReact) for the frontend - structured in vertical slices, the same way
Studio is.

## Capabilities

- **Issue mirror** - issues from every tracked repository are mirrored as events with the
  predictable key `{org}-{repo}-{issue}` (for instance `cratis-studio-256`). Webhooks keep the
  mirror current; a daily consolidation catches anything a missed delivery would skip.
- **Internal status** - each issue carries a Planner-only status: *None*, *Ready for development*,
  *In progress* and *For review*.
- **Ordering and grouping** - issues can be manually ordered by dragging, and grouped so that a
  group is only scheduled when every issue in it is ready.
- **Scheduling** - ready issues become units of work dispatched to worker containers, respecting
  each Claude account's concurrent capacity and per-plan five-hour/weekly session boundaries.
- **Investigations** - issues reported by people outside the organization are automatically
  investigated by an agent (using Opus), which comments its plan on the GitHub issue and suggests
  the model that should implement it.
- **Review flow** - completed work associates its pull request with the covered issues and marks
  them for review; accepting a pull request from the Planner merges it through the GitHub API.

## Documents

| Document | What it covers |
|---|---|
| [How it works](./how-it-works.md) | The flow from GitHub issue to merged pull request |
| [Configuration](./configuration.md) | Every configuration option and what it does |
| [Running locally](./running-locally.md) | Running the full stack with Aspire and Docker |
| [Running in the cloud](./running-in-the-cloud.md) | Production deployment with Kubernetes |

## Repository layout

| Location | Contents |
|---|---|
| `Source/Planner` | The application - backend, frontend and specs in one project |
| `Source/Composition` | The Aspire AppHost for running locally |
| `Source/Claude` | The worker container image (Claude CLI + .NET 10 SDK + Node/Yarn) |
| `.github/workflows/planner-build.yml` | PR build - quality gates and build artifacts |
| `.github/workflows/planner-publish.yml` | Publishes the `cratis/planner` and `cratis/planner-worker` images |
