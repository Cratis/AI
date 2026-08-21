# Prompt — First Approved Cratis/AI Source Move

> **Superseded as a standalone execution prompt.** Source movement now occurs
> inside the complete gated autonomous program in
> [`AI-REPOSITORY-REDESIGN-AUTONOMOUS-PROMPT.md`](./AI-REPOSITORY-REDESIGN-AUTONOMOUS-PROMPT.md).
> Preserve this file as the earlier bounded-move design.
> **Do not execute this prompt yet.** It is activated only after the preconditions
> below are accepted and recorded by maintainers.

```text
Implement the first approved Cratis/AI engineering source move. Stop immediately
unless every precondition below has inspectable accepted evidence.

## Preconditions

1. Read the canonical continuation handover, implementation plan, reevaluation,
   foundation validation record, and current bodies/comments of Cratis/.github#24,
   Cratis/Workflows#68, Cratis/AI#126, and Cratis/AI#127.
2. Record fresh worktree status, branch/upstream divergence, staged/unstaged/
   untracked/ignored names, diff summaries, and SHA-256 hashes of every
   pre-existing changed file. Protect all of them.
3. Verify Workflows#68 records an accepted distribution architecture that meets
   D1. Do not infer acceptance from a design document or this prompt.
4. Verify catalog/schema v2, repository inventory, materializer adversarial
   specs, and project-context fixtures are merged or otherwise explicitly
   accepted at an immutable revision.
5. Verify the engineering ownership-reduction review is accepted: every moved
   rule, agent, prompt, hook, workflow, adapter, and engineering capability has
   one target owner and no public target depends on it.
6. Verify one application and one framework project-context pilot have accepted
   evidence when the move changes discovery or an adapter.

If any precondition fails, update only the decision state and continuation
handover if explicitly requested; do not create a target source tree or move a
file.

## Bounded move

Move only the accepted reusable engineering Agent Skill sources from their
legacy `.ai/skills/<name>/` paths to a deliberately non-auto-discovered path:

    engineering/capabilities/<accepted-target-name>/

Never use `engineering/skills/` or any other recursively discoverable
`**/skills` source path. Move only the eight accepted engineering capabilities:

- add-cratis-docs-page;
- add-traces;
- cratis-csharp-standards;
- edit-cratis-docs;
- qa-cratis-docs;
- ship-changes;
- skill-creator;
- write-documentation.

Keep the complete licensed `skill-creator` bundle together, including its
license, references, assets, agents, viewer, and scripts. Do not publish or add
it to a passive runtime artifact.

Do not move rules, general agents, prompts, hooks, workflows, public skill
candidates, project-owned context, or host adapters in this session unless the
accepted ownership record explicitly includes one as an inseparable dependency.
Stop rather than broadening the scope.

## Atomic updates

For every moved capability:

- use `git mv` only after proving the source is unmodified or its protected
  changes are intentionally included;
- update catalog v2 sources, targets, migrations, ownership inventory, path
  references, and generator inputs atomically;
- keep publication approval false and includeInRuntime false;
- preserve source revision/content digest traceability;
- keep current adapters until replacement host pilots prove parity;
- do not let recursive discovery find the engineering source;
- preserve license and attribution files;
- remove absolute workstation paths and stale private references only through a
  separately reviewable edit with behavior tests.

Protected hook files are not part of this move. If an accepted dependency would
require touching `.ai/hooks/agent-stop.md`, `.ai/hooks/pre-commit.md`,
`.ai/hooks/scripts/validate-ai-setup.sh`, `.gitignore`, or
`Documentation/index.md`, stop and request explicit maintainer approval.

## Validation

Run the complete foundation validation suite before and after the move,
including corpus validation, legacy and v2 catalog validation, strict JSON
parsing, all catalog/materializer/project-context specs, recursive discovery
leak tests, LSP diagnostics for changed code, scoped Markdown lint/link checks,
lens diagnostics, `git diff --check`, fresh status, and protected hash
comparison.

Prove mechanically that:

- all 43 source capabilities remain accounted for exactly once;
- the eight engineering capabilities moved with no missing bundled path;
- public target and artifact definitions are unchanged;
- no engineering source exists under a `**/skills` path;
- recursive `--all` simulation discovers no engineering capability;
- no adapter target broke and no project-owned file changed.

## Stop boundary

Do not create plugin.json, package.json, native marketplace manifests, root
skills/, public/, release refs, archives, packages, install instructions,
publication workflows, propagation changes, commits, pushes, or pull requests
unless separately requested and authorized by the accepted phase plan.
```
