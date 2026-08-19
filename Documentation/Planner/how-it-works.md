# How the Planner works

## The issue mirror

The Planner does not hold all of an issue's data - it mirrors the vitals needed for listing:
organization, repository, number, title, type, who created it, when, the author's association with
the repository and whether it is open. Everything is event-sourced: each issue is its own event
stream keyed `{org}-{repo}-{issue}`, and every change is a fact (`IssueRegistered`,
`IssueRenamed`, `IssueClosed`, ...).

Three mechanisms feed the mirror:

1. **Webhooks** (`POST /webhooks/github`) - the main mechanism. Issue opened/edited/closed/reopened
   events and repository-created events are translated into commands. Deliveries are validated
   against the configured webhook secret.
2. **Initial load** - when a repository is added, a reactor pulls all its issues through the GitHub
   API. Adding an organization discovers and adds all its repositories first.
3. **Daily consolidation** - an Orleans reminder grain re-synchronizes every tracked repository
   once a day, registering anything missed and reconciling titles and open/closed state.

Some issue repositories front a separate private code repository (for instance the public
`StudioIssues` for the private `Studio`). Mapping a code repository on the issues repository makes
scheduled work clone and operate on the code repository instead.

### When the initial load cannot run

Every one of those mechanisms needs a GitHub App installed on the account (see
[Setting up the GitHub App](./github-app-setup.md)). Adding an organization succeeds regardless -
the organization is a fact the Planner records on its own - but the discovery that follows fails
without an App, and so does the issue load for a repository.

Both outcomes are recorded as facts rather than swallowed, so the **Repositories** page always says
what happened: an organization row shows how many repositories were found, or **Discovery failed**
with the reason; a repository row shows **Issues loaded**, or **Issue load failed** with the
reason. The page also warns up front when no App is configured at all. Once the App is connected
and installed, **Retry discovery** on the organization runs the whole load again.

## Status flow

```text
None ──▶ Ready for development ──▶ In progress ──▶ For review ──▶ (accepted / merged)
              ▲                        │ failure
              └───────── None ◀────────┘
```

- A human (or automation) marks an issue **Ready for development**.
- The scheduler turns ready issues into units of **work**. An issue in a group waits until every
  issue in the group is ready; the group is then scheduled as one unit of work.
- When a worker starts, covered issues become **In progress**.
- When work completes with a pull request, the pull request is associated with the covered issues
  and they become **For review**. Accepting merges the pull request through the GitHub API.
- When work fails, covered issues fall back to **None** so a human decides what happens next.

## Scheduling and capacity

The scheduler is an Orleans grain - grain single-threading serializes scheduling passes so
capacity decisions never race. A pass runs every minute (reminder) and immediately when work is
scheduled or an issue becomes ready (poked by a reactor). Each pass:

1. Schedules implementation work for ready, uncovered issues (whole groups as one unit).
2. Dispatches pending work to the first Claude account with capacity:
   - fewer running work items than `MaxConcurrentWorkPerAccount`,
   - fewer sessions started in the rolling five-hour window than the account's plan allows,
   - fewer sessions started in the rolling week than the plan allows.

The model is resolved in order: the model the work was scheduled with, the investigation's
suggested model, then the configured default (`sonnet` for implementation, `opus` for
investigations).

## Workers

A dispatched unit of work becomes a container from the `Source/Claude` image - locally a Docker
container, in production a Kubernetes job. The container receives the work id, a purpose-specific
prompt (including any issue and group instructions), the model, the clone URL(s) and a callback
URL. It clones the code repository - one folder per
repository for ad-hoc work - initializes rtk so the agent's shell commands are routed through the
token optimizer, and runs the Claude CLI with stream-json input/output. The console output is the
event stream the Planner tails live (`GET /api/work/{workId}/log`), text posted to
`POST /api/work/{workId}/input` is forwarded into the session as a steering message, and the
completion callback (`POST /api/work/{workId}/callback`) carries the session's token, cost and
duration usage. Stopping work kills the container or Kubernetes job.

### How credentials reach a worker

The account's Claude CLI token, the GitHub installation token, the
per-work callback token and any operational credentials an alert
investigation was granted **do not travel as environment variables**.
Anything on the container specification is readable by whoever can read
the specification (`kubectl get job -o yaml` in the worker namespace, or
`docker inspect` on the host), and it outlives the container, because
the specification does.

They are delivered out of band instead, and both runtimes land on the
same contract: a file of shell assignments at
`/run/planner-secrets/secrets.env`, named to the entrypoint by
`PLANNER_SECRETS_FILE`, which the entrypoint sources and then deletes.

- **Kubernetes** creates a per-job `Secret` and mounts it read-only at
  mode `0400`. The secret is owner-referenced to the Job, so it is
  garbage-collected with it.
- **Docker** creates the container, copies the file onto a `tmpfs`
  mount, and only then starts it - so the credentials never touch the
  container's writable layer. A readiness marker is written after the
  file, and the entrypoint waits for that marker rather than for the
  file, so it cannot read a half-extracted credential.

Only non-secret configuration - the model, the callback URL, the branch,
endpoints and namespaces - remains on the container specification.

Account selection prefers the requesting user's own Claude account(s); work scheduled by
automation - webhooks, auto-investigations, the scheduler itself - draws from the pool, picking
the account with the most headroom left in its windows.

- **Implementation** work builds, tests, commits, pushes a branch and opens a pull request
  referencing the issues. Workers are instructed to report bugs they find in upstream Cratis
  repositories as issues on those repositories.
- **Investigation** work produces an implementation plan without changing code, comments the plan
  on the original GitHub issue, and suggests the implementation model through a
  `SUGGESTED-MODEL:` marker the callback parses.

## Investigations for external reporters

When an issue is registered whose author has no association with the organization, a reactor
automatically schedules an investigation. The findings are recorded on the issue, commented back
on the GitHub issue for the reporter and team to see, and the suggested model is used when the
implementation is later scheduled.
