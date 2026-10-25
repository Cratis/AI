<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Unattended guards

An unattended lane has nobody to answer a question. The contract is checkable:
no hook or tool may wait for interactive input, and every command has a time
box.

## The no-prompt contract

- Every command runs without a terminal prompt: explicit flags, values passed
  by argument or environment, stdin closed (`< /dev/null`).
- Every command has a deadline. A hung command is killed by its box, not
  waited on.
- A hook that would ask is a blocker, not an obstacle. Never loosen a hook,
  allowlist or guard to avoid a prompt; report it. See
  [hooks/README.md](../../../hooks/README.md) for how denials behave when no human
  is present.
- Secrets are never typed into a prompt: see
  [secrets.md](../../../rules/secrets.md).

## Time boxes

Use the defaults and bounds in
[placeholders.md](../../cratis-orchestration-lanes/references/placeholders.md);
a brief may override within those bounds.

| Box | Default | Action at the limit |
|---|---|---|
| Targeted check | 120 seconds | Stop and diagnose |
| Build or test phase | 300 seconds | Stop and diagnose; longer needs approval |
| Detach threshold | 600 seconds | Run detached; do not wait |
| Queue wait | per the brief | Send a `blocked` message |

## A silent command is diagnosed

A command that prints nothing is not "still working". Inspect: is the process
alive, what is it waiting on (a prompt, a lock, the network), what changed in
its output directory. Fix the cause or report it; do not extend the box.

## Detach rule

Work expected to exceed the detach threshold runs detached, with output going
to a file under `<work-root>`, and reports through a completion notification.
The lane does not poll it by hand. Where the harness has no notification, the
blocking watch described in `cratis-engineering-ci-gates` holds the wait.

## Checkable example

A command that would prompt, made non-interactive and boxed:

```bash
# Would prompt: gh pr merge <n>   (asks how to merge)
# Non-interactive, explicit strategy, stdin closed, 120 second box:
timeout 120 gh pr merge <n> --repo owner/repo --merge < /dev/null
echo "exit=$?"
```

Verify it behaves: the command must return within the box and the exit code
must be explicit. Exit `124` means the box expired: diagnose, do not rerun
with a longer box. Any other nonzero exit is the command's own failure.
To prove that nothing waits on input, run the same command with stdin
closed and confirm it fails fast rather than hanging.
This example shows the form only; merging still needs the authorization and
the three state checks in the skill.
