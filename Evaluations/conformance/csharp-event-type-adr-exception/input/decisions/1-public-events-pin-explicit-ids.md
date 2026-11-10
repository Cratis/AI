---
id: 1
title: Public events pin explicit ids
status: accepted
stage: implemented
class: contract
reversibility: costly
decided: 2026-01-15
decider: Example Maintainer
applies-to:
  - "Source/**/*.cs"
issues: []
---

## Context

Other systems consume this library's public events by id, so the ids must not depend on CLR type names.

## Decision

Every new public event type pins an explicit id: `[EventType("<id>")]`. This replaces the corpus rule in `application-profile.md` item 7 (plain `[EventType]` for new events) for this repository's public events.

## Consequences

A new public event always carries an explicit id.
