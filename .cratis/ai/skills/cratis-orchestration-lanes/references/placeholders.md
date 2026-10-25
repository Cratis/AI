<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Placeholders and defaults

Nothing here is configuration read by code. The templates use `<placeholders>`;
the operator fills them in a brief. The defaults are documented values an
operator may override in their own brief, within the bounds shown.

## Placeholders

| Placeholder | Meaning |
|---|---|
| `<lane-id>` | Short alphanumeric id of one lane; unique per repository |
| `<operator>` | The human who owns the goal |
| `<coordinator>` | The lane that keeps the claim register and assembles the candidate |
| `<repo>` | The repository (`owner/name`) the work targets |
| `<gate-command>` | The one exact command that proves the lane is done |
| `<work-root>` | Directory for briefs, inbox, outbox and handoffs; default `.ai-work` |

## Defaults

| Default | Value | Override bounds |
|---|---|---|
| Claim lease expiry | 4 hours without a status update | Any duration; expiry only marks a claim stale, never transfers it |
| Blocked-report threshold | 20 minutes waiting | Any duration, shorter or longer |
| Review round cap | 3 per work item, owned by `cratis-engineering-review-rounds` | Lower only; never raise |
| Targeted-check time box | 120 seconds | Any duration; a silent command is diagnosed, not given more time |
| Build or test phase time box | 300 seconds | Up to 600 seconds; longer needs the user's explicit approval |
| Detach threshold for long work | 600 seconds | Any duration; work beyond it runs detached and is polled |
| Work root | `.ai-work` | Must stay under `.ai-work/` |

A brief states each override explicitly. An override never weakens a rule,
a required gate or the escalation list.
