# Provenance

Authored by Cratis for Cratis/Stagehand#118, under the repository's own MIT license (see the
`LICENSE` file at the repository root) - not vendored from a third party.

## Why this exists instead of vendoring the requested source

Issue #118 named a specific upstream skill: `primereact-ui-basics`, from `P0ngCh4ng/dotfiles`
(`.claude/skills/primereact-ui-basics/SKILL.md`). That repository is a personal dotfiles collection
and carries **no license file and no license statement anywhere in it** - under default copyright,
the author has not granted permission to copy, redistribute, or bundle that file into another
project or a built Docker image, regardless of attribution. Cratis's own vendoring convention
(`.ai/skills/skill-creator`, and `skills/react-agent-skills` vendored alongside this file) always
carries the upstream license forward verbatim specifically *because* one exists to carry; there
was nothing to carry here.

Rather than skip the second requested skill entirely, or vendor it anyway without a grant, this file
is an original skill covering the same ground - PrimeReact/Cratis Components sizing, spacing,
accessibility, and consistency baselines - written independently in Cratis's own words and tailored
to the actual Cratis Components wrappers this application's frontend uses (`CommandDialog`,
`CommandForm` fields, `PanelCard`, `Toast`, the project's own `Dialog` wrapper), which the generic
upstream file could not reference anyway.

**This is a product decision that should be revisited by a human before it is treated as final**:
either (a) this original skill stands in permanently, (b) someone secures explicit permission or a
license from the upstream author and it is replaced with a proper vendor of the original, or (c) the
scope is judged not worth pursuing further. Recorded here rather than silently decided.
