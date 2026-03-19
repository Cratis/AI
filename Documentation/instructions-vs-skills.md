# Instructions vs Skills

This is the most important distinction in the Cratis AI configuration. Getting it right keeps instruction files small (fast context loading) and skills detailed (rich implementation guidance).

See also: [Instructions](./instructions.md) · [Skills](./skills.md)

---

## The core distinction

| | Instructions | Skills |
|---|---|---|
| **Answers** | *What* to do and *when* it applies | *How* to do it, step by step |
| **Loaded** | Automatically, based on file type | On demand, when explicitly invoked |
| **Size** | Small and focused | As detailed as needed |
| **Format** | Rules, constraints, naming conventions | Steps, templates, examples, checklists |
| **Lives in** | `.github/instructions/*.instructions.md` | `.github/skills/<name>/SKILL.md` |

---

## Why this matters

Instruction files are loaded into the AI context window **automatically for every file interaction** that matches their `applyTo` glob. Every token spent on instruction detail is a token not available for actual code context.

If `csharp.instructions.md` contained a 200-line step-by-step walkthrough for creating a command, those 200 lines would load into context every time Copilot touched any `.cs` file — even when the developer is just fixing a typo in a utility class.

Skills are loaded **only when explicitly needed**. The 200-line command walkthrough belongs in `skills/cratis-command/SKILL.md`, where it loads once, on purpose, for the developer who is actively creating a command.

---

## How to decide where something belongs

Ask these questions:

### 1. Is this a rule the developer must always follow?

If yes → **instruction**.

> "Commands define `Handle()` directly on the record — never create separate handler classes."

This is always true. It loads with every C# file.

### 2. Is this implementation guidance for a specific task?

If yes → **skill**.

> "Here are the 6 steps to create a new command, including the validator, the React dialog, and the proxy hook."

This is only needed when someone is building a command. It belongs in `cratis-command/SKILL.md`.

### 3. Is this a short code example illustrating a rule?

If yes → can stay in an **instruction** (keep examples short).

> ```csharp
> [Command]
> public record RegisterProject(ProjectName Name)
> {
>     public ProjectRegistered Handle() => new(Name);
> }
> ```

A 4-line example that shows the rule in action is fine in an instruction.

### 4. Is this a long template or scaffolding pattern?

If yes → **skill**.

Full file templates, multi-step scaffolding sequences, and detailed API usage patterns belong in skills with their own reference documents.

---

## Practical examples

### ✅ Correct — Rule in instruction, detail in skill

**`csharp.instructions.md`:**
```markdown
## Commands
- Records decorated with `[Command]` from `Cratis.Arc.Commands.ModelBound`.
- `Handle()` is defined directly on the record — no separate handler class.
- Event source is resolved from the `[Key]` parameter, an `EventSourceId`-convertible type, or `ICanProvideEventSourceId`.

For step-by-step command creation, invoke the `cratis-command` skill.
```

**`skills/cratis-command/SKILL.md`:**
```markdown
# Creating a Command

## Step 1 — Define the command record
...detailed template and options...

## Step 2 — Add a validator
...FluentValidation patterns...

## Step 3 — Generate the TypeScript proxy
...dotnet build and proxy location...

## Step 4 — Wire up the React dialog
...CommandDialog usage...
```

---

### ❌ Wrong — Detail crammed into instruction

**`csharp.instructions.md`** (too much):
```markdown
## Commands

Step 1: Create a record decorated with [Command]...
Step 2: Add Handle() method that returns an event...
Step 3: Create a CommandValidator<T>...
Step 4: Run dotnet build to generate proxies...
Step 5: Create CommandDialog in React...
Step 6: Wire up useDialog in the composition page...
[... 80 more lines ...]
```

This detail loads into every `.cs` file context. It belongs in a skill.

---

## When instructions reference skills

Instructions should end major sections with a skill reference when one exists:

```markdown
## Projections
- AutoMap is on by default — call `.From<EventType>()` directly, no `.AutoMap()` needed unless previously disabled.
- Projections join **events**, never read models.
- Prefer model-bound attributes (`[FromEvent<T>]`, `[Key]`) over fluent projections for simple cases.

→ For step-by-step projection creation, invoke the `add-projection` skill.
→ For creating a read model from scratch, invoke the `cratis-readmodel` skill.
```

This keeps instructions at the right level while making the skills discoverable.

---

## Summary

| If you're writing… | Put it in… |
|---|---|
| A naming rule | Instruction |
| A "never do X" constraint | Instruction |
| A 4-line code example showing a pattern | Instruction |
| A step-by-step workflow | Skill |
| A full file template | Skill |
| Detailed API usage with multiple options | Skill |
| A build/verify sequence | Skill |
| A completion checklist for a task | Skill |
