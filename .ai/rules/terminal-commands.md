---
applyTo: "**/*"
description: "Use when a shell command chains several commands with && or |. rtk.md is the authority on rtk usage; this rule only covers the chain case the auto-rewrite hook cannot handle on its own."
---

# Terminal Commands — rtk and command chains

**[rtk.md](./rtk.md) is the authority on rtk.** Read it first: it explains that a `PreToolUse` hook
auto-rewrites supported Bash commands to their `rtk` equivalent, what rtk covers, and where the
built-in `Read`/`Grep`/`Glob` tools bypass the hook. For a single supported command you do nothing
special — run it normally and let the hook wrap it.

This rule covers the one case the hook cannot reliably handle on its own.

## Command chains

The hook rewrites the command it is given; it does not necessarily rewrite every segment of a
chain. When you compose several commands with `&&`, `||`, or a pipe, prefix **each** segment
yourself so no segment escapes rtk:

```bash
# ❌ Only the first segment is covered
git add . && git commit -m "msg" && git push

# ✅ Every segment routed through rtk
rtk git add . && rtk git commit -m "msg" && rtk git push
```

The same applies to a segment rtk has no dedicated filter for — `rtk` passes it through unchanged,
so prefixing is always safe. If `rtk` is not on `PATH`, ignore this rule and run the commands
normally; never block work on rtk being present.
