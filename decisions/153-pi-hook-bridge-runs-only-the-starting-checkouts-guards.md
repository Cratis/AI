---
id: 153
title: The Pi hook bridge runs only the starting checkout's guards (no per-call corpus selection)
status: proposed
stage: none
class: contract
reversibility: costly
applies-to:
  - ".cratis/ai/harnesses/pi/extensions/cratis-hooks/index.ts"
  - ".cratis/ai/hooks/README.md"
  - "Source/Verification/pi-hook-corpus-selection.spec.ts"
issues:
  - "Cratis/AI#1114"
---

## Context

The Pi hook bridge chooses its guard scripts once, when the extension loads: the starting checkout's `.cratis/ai/hooks/scripts`, else the bundled corpus. A command or file path that targets a different checkout is judged by those guards. When that other checkout carries a newer guard corpus, the session's older guards can refuse something the newer ones would allow. Cratis/AI#1114 asked whether the bridge should pick the guard corpus per call.

In a managed session the bundled corpus is the same set of files as the session's own corpus (the managed copy under `.pi/extensions` is a symlink into `.cratis/ai`), so there is no independent bundled copy to compare against. The manifest records a source commit and per-file hashes only; it has no release number, no orderable revision and no signature.

## Decision

Do not select a guard corpus per call. A session runs the guards of its starting checkout (or the bundled corpus when that checkout has none), and never executes scripts from a checkout that a command or path merely names. The bridge changes nothing; a specification pins the behavior.

Exception, tracked separately in [Cratis/AI#1256](https://github.com/Cratis/AI/issues/1256): the session's `cratis-guard-writes.sh` reads *policy* about the write target's repository when it decides dependency-manifest writes. The target's boolean `allowDependencyManifestWrites` in its `.cratis/ai.json` overrides; when that is absent, the target's GitHub `Cratis/*` origin decides. That reads data about the target; it never runs the target's scripts.

Remedy for a false refusal: run `cratis ai update` in the starting checkout (scripts are read per call, so no restart), or start the session in the checkout you change.

## Options considered

- **Document the rule and pin it with a spec (chosen).** Adds no attack surface. An agent-writable checkout never supplies a weaker guard than the session's.
- **Per call, run the target's corpus when it is newer and its hashes verify (rejected).** The target's own manifest proves nothing: whoever can write the scripts can also write the manifest and recompute every hash. A usable trust anchor must come from outside the checkout (hashes or a signature pinned in the session, or an ordered release index fetched from the network), and none exists. A session cannot know hashes of releases newer than itself, and git ancestry of a writable checkout is forgeable. Further hazards even with an anchor: the script is read by `bash` at spawn, so verify-then-run on a writable path can be swapped; newer is not stronger, because a later release may legitimately relax a guard; the target is inferred by parsing `cd X && …`, `git -C X`, `$(…)`, variables and subshells in a string the agent controls, so the agent picks which checkout counts; symlinked scripts directories and `hook-lib.sh`; and running two corpora side by side widens the compatibility surface.
- **Warn at session start that the corpus is older (deferred).** Comparing with the bundled corpus is vacuous in a managed session. Comparing with the current upstream commit is sound but needs a remote lookup, and a commit comparison says "different", not "older". Revisit when the CLI records an orderable guard revision in the manifest.

## Default if unanswered

The bridge keeps running the starting checkout's guards, which is also the behavior this record describes.

## Timeline and scope

Holds from the corpus release carrying it, for the Pi bridge. Revisit when the manifest carries an orderable revision or a signature that a session can verify from outside the checkout.

Done when: `Source/Verification/pi-hook-corpus-selection.spec.ts` passes and the hooks README states the rule.

Verify by: run the specification; temporarily make the bridge choose scripts from the call's `cwd` and see it fail.
