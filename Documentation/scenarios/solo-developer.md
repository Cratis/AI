# Scenario: solo developer

One person, one coding tool, building on Cratis.

## What you do

Install the plugin for your harness and start working. See the
[harness guide](../harnesses.md) for the exact command for your tool — for
Claude Code:

```text
/plugin marketplace add Cratis/AI
/plugin install cratis@cratis
```

That is the whole setup. There is no `.cratis/` directory to create, no
subscription file to commit, and no configuration.

## What you get

Your assistant quietly loads verified Cratis guidance when your task matches
one — writing a command, modeling an event flow, adding a projection,
debugging a stale read model. Skills are passive markdown: no hooks, no
executable code, no MCP server, and nothing installed into your project.

Your own configuration stays yours. Keep whatever you already have in
`.claude/` (or your host's equivalent) and put whatever you want in it. The
plugin does not touch it.

## When you don't need this page

If you already installed the plugin, you are done. The team-repository
machinery (`.cratis/ai.json`, version pins) exists for repositories shared by
several people or tools — a solo developer can ignore it entirely.

The one rule that applies to everyone: never copy the shared corpus (this
repository's `.ai`, `.claude`, `.github`, or skill folders) into your own
repository. Install the plugin instead; the copy would go stale and silently
drift from the reviewed source.

## Status

- Installing today means following the `Cratis/AI` default branch. The
  versioned-release flow is designed but not published yet.
- Everything is an unsupported `0.x` evaluation until the governed release
  gates pass.
