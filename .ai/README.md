# Shared AI Assistant Configuration

This folder is the single source of truth for shared AI assistant artifacts.

## Structure

- `rules/` contains shared instruction files.
- `prompts/` contains reusable prompt templates.
- `agents/` contains reusable agent definitions.

## Tool integration

- GitHub Copilot files under `.github/` are symlinks to files in `ai-dev/`.
- Claude Code files under `.claude/` are symlinks to files in `ai-dev/`.

## Scoped rule frontmatter

Scoped rules include both:

- `applyTo` for GitHub Copilot instruction matching.
- `paths` for Claude Code rule matching.

When adding or changing a shared rule, update the file in `ai-dev/` only.
