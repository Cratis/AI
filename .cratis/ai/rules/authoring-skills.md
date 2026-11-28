---
applyTo: ".cratis/ai/skills/**,.cratis/ai/rules/**,.cratis/ai/agents/**,.cratis/ai/prompts/**"
paths:
  - ".cratis/ai/skills/**"
  - ".cratis/ai/rules/**"
  - ".cratis/ai/agents/**"
  - ".cratis/ai/prompts/**"
---

# Authoring skills and rules

A skill teaches one task. Add one when a reader cannot complete a task with the existing skills, not to document a product area. These rules apply to skills written for the Cratis corpus. A vendored third-party skill keeps its upstream text, license and notice; change it only to keep its links and packaging valid.

## Name and description

- The directory name equals `name`: 1–64 lowercase letters, digits and single hyphens, no leading or trailing hyphen, and neither `anthropic` nor `claude`. A new skill is named `cratis-<area>-<task>`.
- Use only the portable frontmatter fields `name`, `description`, `license`, `compatibility`, `metadata` and `allowed-tools`. Vendor-specific values go under `metadata`, as strings.
- The description starts with `Use when` or `Use before` and states the task and the situation in the reader's words, then names the nearest skill to use instead. It holds invocation conditions only: capabilities, outputs and how-to belong in the body. Write it in neutral voice, without `I`, `you` or `your`, because descriptions are loaded as instructions.

For example: `Use when an existing Arc query needs server-side paging. Not for creating a read model (use cratis-chronicle-project-view).`

## Body

- **One default.** Give one recommended path and at most three choices in total, each with "choose this when". An exclusion points to exactly one other skill.
- **Steps a newcomer can follow.** Start from stated prerequisites. Give one small correct example per pattern, the output the reader should observe and what to do when it is absent. Separate example names from conventions, and read-only inspection from writes.
- **Observable done-conditions.** Every step ends in something checkable: a file exists, a command passes, a named check returns a value. A step without one invites stopping when the result merely looks plausible.
- **A reason beside every absolute.** The reason lets the reader recognize where the rule stops applying; volume and capitals add nothing.
- **Prune by behavior.** For each sentence ask whether deleting it would change what the reader does. If not, remove the whole sentence. Never shorten by cutting a step, a condition or an example that changes behavior.
- **Write for the class of task**, not the run the skill came from: strip that run's repository, file names and one-off details.
- **American English** in authored text.

## Checked, timeless claims

Check every API, flag, shape, package, default and version constraint against a released version before writing it. Keep the evidence in review notes, not in the skill: no source paths, line citations, commit hashes, issue or pull-request numbers, probe results or dates.

A version is kept only when it marks a prerequisite. Before deleting one, decide what it marks, because deleting it blindly turns a true statement into a false one:

- **History** (when something was verified or shipped): remove it.
- **The release that introduced a behavior**: state it at the step that needs it, naming the release from the product's tags.
- **A behavior that changed in a release**: state the release and what older releases do.

## Size, references and links

- Aim for under 750 words in `SKILL.md`. Verification fails a body above 500 lines or 20,000 characters.
- Put conditional detail in `references/`, one level deep, and name every reference file from `SKILL.md` with the condition for reading it. A reference above 100 lines opens with a `## Contents` list.
- At the actual handoff, use a relative link such as `../cratis-<name>/SKILL.md` only if every profile and language selection that installs the source also installs the target; otherwise name the target skill in backticks without linking to it.
- A skill never links or refers to a path that exists only in the corpus repository, such as its documentation, evaluations or verification sources. Installed skills are read without them.
- Refer to a rule by name, in backticks, with the profile that installs it. Do not link to a rule from a skill: the rule may not be installed where the skill is.

## Tasks that several SDKs implement

Cratis applications are written in C#, TypeScript (Node server and React), Kotlin, Java, Go and Elixir, and the SDK feature sets differ; Python has no released application SDK. Write one skill per task, not one per language. An existing shared skill whose `SKILL.md` carries a single language's code is converted: that code moves to its `references/<lang>.md`, and the other languages get a reference or a stated gap.

- **`SKILL.md` stays implementation-neutral.** It states the decision, the default, the expected outcome and when to stop, and it contains no host-language code. It tells the reader which artifact selects which reference: `*.csproj` → C#, a Node server `package.json` → TypeScript, `*.kt` → Kotlin, `*.java` → Java, `go.mod` → Go, `mix.exs` → Elixir. A React `.tsx` consumer of generated proxies is a different task from a Node server.
- **Each SDK gets its own reference:** `references/csharp.md`, `typescript.md`, `kotlin.md`, `java.md`, `go.md`, `elixir.md`. Java has its own file even where its annotations match Kotlin's. Each reference gives the native prerequisite, one worked example, the observable result and what to do when it is absent. Split a reference into `references/<lang>-<topic>.md` only when one file cannot hold the material usefully.
- **State every gap.** For each SDK without the capability, `SKILL.md` names it as unsupported and gives the safe alternative. Never let the reader adapt another language's reference. Python gets `references/python.md` only for a verified boundary, such as contracts or an external worker, never for a guessed recipe.
- **Split into a separate skill** only when the trigger, default, nearest exclusion or done-condition differs, or when only one implementation exists (EF Core migrations, MCP exposure, Spring Data, ESLint, React view models). Such a skill teaches its one implementation directly, with no router. Syntax differences alone never justify a second skill.

Neutral modeling, Screenplay and operator skills may use topical references; that exception never covers language-specific material in a shared skill.

## One source of truth

A skill owns its task. Another skill or rule that touches the task hands off to it instead of repeating the steps, because copies diverge on the next edit. Resolve a contradiction at its source.

## MCP tools and scripts

Name the server once, then its protocol tool: the `screenplay` MCP server's `propose-ast` tool. The harness-native tool name comes from the connected client's tool listing; a fixed prefix can address the wrong server.

Put a repeatable mechanical operation in `scripts/` when a script removes repeated reasoning. Say to execute it, with its prerequisites, inputs, errors and pass signal. The script preserves the wrapped command's exit status: apparent success after a check that did not run is not verification.

## Rules

`general.md` stays within one page and holds only what every session needs. Add a rule only for a constraint that applies regardless of task; anything task-shaped belongs in a skill. Every other rule declares `applyTo` and `paths` globs narrow enough that it loads only where it applies, and a `profile` when only some repositories need it.

Prose does not enforce itself. A constraint that an analyzer, a lint, a hook or CI can check ships as that check, with at most a one-line pointer in a rule.

## Evaluate behavior

When authoring or materially changing a skill, keep at least three realistic requests that should select it and three near misses that name the sibling that should win in `Evaluations/corpus-v2/skills/<skill>/trigger.json`. Keep one to three output tasks with checkable assertions in `evals.json` in the same directory.

When model runs are authorized, evaluate routing and compare each output task with the same task run without the skill. For these cases, `verify` checks the inputs; it does not prove routing or improvement. If model runs are unauthorized or not run, report behavior as **unverified**, not passing.

## Change together, then verify

Change the skill, its `references/` and its entry in `profile-catalog.json` in one change. Regenerate the harness adapters after changing a rule; never edit a generated adapter. Then run:

```bash
yarn workspace @cratis/harness-setup run setup
yarn workspace @cratis/ai-verification run verify
git diff --check
```

A pass is exit code 0 from each. Finally, read the skill as someone who has never seen the artifact; if a step is missing, add it.
