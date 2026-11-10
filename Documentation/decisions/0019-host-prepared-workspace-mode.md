<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# 0019 - Host-prepared workspace mode

## Status

Proposed

The requester explicitly supplied these implementation decisions on November 10, 2026.
Named-decider attribution remains pending; this record does not claim acceptance on
behalf of an unidentified person. Implementation proceeds under that explicit request.
Related: Cratis/AI#1069 and Cratis/AI#1070. Builds and runtime verification remain pending.

## Context

Some Docker hosts already own the checkout a worker must edit. Cloning it again adds
credential delivery and network failure modes, while mounting its git metadata writable
would let the worker install configuration or hooks that execute when the host next runs
git. The mode must not turn a container's edits into host code execution.

A bounded git operation is also different from an ordinary refresh failure. Falling back
to a cached mirror after exhausting the entire network deadline would hide a stalled run.

This decision applies to the worker harness, Docker and Kubernetes launch boundaries,
worker launch outcomes, and hosts collecting the results. It holds from the introduction
of this mode until explicitly superseded. A Kubernetes PVC design, writable metadata
sandbox, push deadlines, and general containment of every agent capability are out of scope.

## Decision

- Unset or empty `CRATIS_WORKSPACE_MODE` preserves the clone workflow. Only the exact
  value `host-prepared` opts in; unknown non-empty values fail closed.
- Host-prepared mode refuses repository credentials and clone/push inputs in environment
  variables or secrets, even if empty, rather than silently scrubbing them. Scrubbing
  would conceal a caller wiring error and make the absence of repository authority
  unobservable. Provider authentication remains allowed. Bundle-diff is a different mode.
- The host must configure an existing absolute `HostWorkspaceRoot`. Only existing direct
  children are accepted: exactly one relative path segment, no traversal, symlinks/reparse
  points, bind-string separators or sibling-prefix matches. Arbitrary nested descendants
  are not accepted because another running worker could replace their ancestors.
- Docker mounts the work tree read-write, then overlays its direct `.git` entry read-only.
  The entry must exist and must not be a symlink. Gitfiles pointing outside the workspace
  are unsupported and refused. An internal gitfile's top-level metadata subtree is also
  read-only: protecting only the gitfile, or only the final gitdir below writable ancestors,
  would still permit metadata replacement or redirection. Gitdir traversal and symlink
  segments are refused. Internal gitfiles must be relative: absolute host paths cannot
  follow the container's `/workspace` remapping and are refused at launch.
- The result is **uncommitted working-tree changes**, collected by the host. The entrypoint
  never stages, commits, writes refs, changes repository configuration or pushes in this
  mode. Its safe-directory registration writes only container-global configuration. A
  writable object store or separate commit sandbox is not part of this contract.
- The host still collects with hardened git: `-c core.fsmonitor=false
  -c core.hooksPath=/dev/null`, no host `safe.directory` trust of the workspace, and no
  submodule recursion. Worktree files such as `.gitattributes` remain writable, so diff
  collection also disables external diff and text conversion. Read-only metadata is not
  permission to treat the result as trusted code.
- Validation is a launch-time check, not a race-free filesystem capability. The host must
  keep its trusted root, immediate child directory and git metadata stable until Docker
  resolves the binds. Direct-child-only paths prevent workers in other workspaces from
  owning intermediate directories, but do not prevent a privileged host actor swapping
  an entry between validation and mount. Atomic descriptor-based mounting is not available
  through this runtime's Docker bind API.
- Every harness clone, `ls-remote` and fetch has a configurable finite deadline. An ordinary
  mirror refresh error may retain the existing cached-HEAD fallback. A timeout of
  `ls-remote` or fetch fails the run instead: continuing would hide the deadline breach.
  Exit 137 is a timeout only after sufficient elapsed wall time; an earlier kill is not
  misreported as a network deadline.
- Invalid launch inputs return `WorkerLaunchOutcome.InvalidWorkspace` before engine or
  cluster resources are created or removed. Kubernetes refuses this host-bind mode.

## Consequences

The default without opt-in remains cloning, with its existing credential requirements;
the absence of a configured trusted root disables host-prepared mode. Hosts opting in
own checkout preparation, stable paths and hardened result collection. Linked worktrees
whose gitdir is outside their directory must use another workflow. Internal gitfile
metadata subtrees cannot also serve as editable working-tree content.

Appending `InvalidWorkspace` preserves previous enum numeric values but **breaks exhaustive
switches downstream**, including Direct. Consumers must handle it as a terminal job/configuration
error, not a capacity retry. This compatibility cost is intentional and must be delivered
with the corresponding caller update; it is not hidden behind an exception.

## Verification

Done when invalid modes, forbidden inputs, unsafe paths and metadata are refused before
engine contact; container specifications overlay read-only metadata after the writable
tree; host-prepared delivery leaves uncommitted changes; and git kills/timeouts retain
their distinct failure details.

Verify by the HostWorkspace and Docker/Kubernetes specifications, entrypoint fixtures
(including the Linux-only real GNU timeout cases), and WorkerCacheFixture's Docker checks
that metadata writes fail while work-tree writes reach the host. Shell verification is
local; .NET and Docker verification must pass before describing implementation as verified.
