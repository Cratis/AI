---
on:
  preToolUse:
    tool: runInTerminal
---

# Pre-commit — Run Specs

Before executing any `git commit` terminal command, automatically run the specs for every affected project to ensure nothing is broken before changes are recorded in version control.

Also run AI setup integrity validation when AI framework files are staged.

## When this hook applies

This hook fires before **every** `runInTerminal` call. Check whether the command being run is a `git commit` (including `git commit -m`, `git commit --amend`, etc.) or an `rtk git commit` variant. If it is not a commit command, do nothing and let the tool proceed.

## Steps

1. **Detect a git commit command** — inspect the terminal command string. Treat both `git commit ...` and `rtk git commit ...` as commit commands. If neither pattern matches, skip all steps below and proceed normally.

2. **Identify affected projects** from the staged changes:

   ```bash
   git diff --name-only --cached
   ```

   Collect unique project roots using the same rules as the `agentStop` hook:
   - `.cs` files → walk up to the nearest `.csproj`.
   - `.ts` / `.tsx` files → walk up to the nearest `package.json` with a `"test"` script.

3. **If any staged file is under `.ai/`, `.github/`, `.claude/`, or `Documentation/`, run AI setup validation**:

   ```bash
   bash .ai/hooks/scripts/validate-ai-setup.sh
   ```

   If this fails, block the commit and report each violation.

4. **Run specs for each affected .NET project**:

   ```bash
   dotnet test <specs-project-path> --no-build
   ```

   If the specs project cannot be identified, run `dotnet test` from the repository root.

5. **Run specs for each affected TypeScript project**:

   ```bash
   yarn test
   ```

   Run from the package root that owns the changed files.

6. **If any spec fails**:
   - Report the full test output including which specs failed and why.
   - **Do not proceed with the `git commit`** — block the tool call and fix the failures first.
   - Re-run the relevant specs to confirm they pass before retrying the commit.

7. **If all checks pass** — proceed with the `git commit` as originally requested.

## Rules

- Never skip the spec run before a commit, even for "minor" or "documentation-only" changes.
- Never skip AI setup validation when AI framework files are staged.
- A commit must not be made while any spec is failing.
- If a spec was already failing before the current changes (pre-existing failure), report it but do not block the commit — note the pre-existing failure clearly in the session output.
