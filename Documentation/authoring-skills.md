# Authoring skills

A skill teaches one task. Add one when a reader cannot complete a task with the existing skills, not to document a product area. This checklist is for Cratis-authored skills; preserve vendored skills’ upstream authorship, license and attribution.

## Checklist

1. **Name and description.** The folder name equals `name` and follows `cratis-<area>-<task>`. The description starts with `Use when` and states the task and the situation in the reader's words, then names the nearest skill to use instead.
2. **One default.** Give one recommended path and at most three choices in total, each with "choose this when". An exclusion points to exactly one other skill.
3. **Steps a newcomer can follow.** Start from stated prerequisites. Give a small idiomatic example, the output the reader should observe and what to do when it is absent. Separate example names from conventions, and read-only inspection from writes.
4. **Checked claims.** Check every API, flag, shape, package, default and version constraint against a released version listed in [compatibility](./compatibility.md). Keep the evidence in review notes, not in the skill: no source paths, commit hashes or issue history. When a feature needs a later release, say so at that step.
5. **Size and links.** Aim for under 750 words in `SKILL.md`. Put conditional detail in `references/`, one level deep. Link to another skill at the actual handoff with a relative path (`../cratis-<name>/SKILL.md`); the target must be installed by every profile that installs the source. Otherwise, name the skill and its profile without a link. Do not link from a skill to a rule.

Then read it as someone who has never seen the artifact. If a step is missing, add the step.

## Files to change together

- `.cratis/ai/skills/<name>/SKILL.md` and its `references/`.
- `.cratis/ai/profile-catalog.json`: add the name only to the profiles that own the task. Do not broaden a profile merely to satisfy a link.
- [Migration](./corpus-migration.md) when a skill is renamed or removed.

A compiled example under `Evaluations/corpus-v2/examples` is optional. Add one only when a build is the cheapest way to keep the skill's example correct, and never link to it from the skill.

## Verify

```bash
yarn install --immutable
yarn workspace @cratis/ai-verification run verify
git diff --check
```

## Rules

`rules/general.md` stays within one page (450 words). Add a rule only for a constraint that applies regardless of task; anything task-shaped belongs in a skill. A scoped rule needs `applyTo` and `paths` globs narrow enough that it loads only where it applies, and a `profile` when it is meant only for particular repositories. Regenerate harness adapters after changing rules; do not edit generated Copilot instruction copies.
