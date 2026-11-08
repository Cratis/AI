---
agent: agent
description: Reverse engineer an observable system (start URL, HAR, OpenAPI document or repository) into a reviewed Screenplay model and run it.
---

# Reverse Engineer a System

Run the **cratis-screenplay-reverse-engineering** skill end to end for the input the user gave: a
start URL, a HAR file, an OpenAPI document or a repository. Follow its safety section before
touching anything.

## Confirm first

- **Permission:** the system is owned by the user or the user may test it. If not, stop.
- **Discovery questions:** reuse what the user already said. Ask only what is missing, at most
  two, one per turn: the start URL and actor, then any guidance for the walk. Unattended, assume
  read-only, no hosted-model use and no writes, and record the assumptions.
- **Model root and slug:** where an accepted model belongs, and the work area
  `.ai-work/screenplay/<slug>/re/`.

## Chain

1. **Intake and evidence:** inventory the entry points, collect evidence from each source given,
   scrub any HAR or capture before use, and write the evidence file with its unknowns.
2. **Synthesis:** build the candidate through the Screenplay MCP propose, read-proposal, apply
   loop, one slice at a time, citing evidence ids.
3. **Review loop:** self-check, independent Screenplay Reviewer pass, then show the timeline
   table and a keep / change / remove choice per slice. Re-synthesize only changed slices.
4. **Run:** `cratis run <model folder>`; use `cratis render` only when real code is wanted.
5. **Fidelity check:** re-walk the observed journeys on the running app and report pass, fail
   or not run per journey.

## Stop at each approval point

Stop and say what is needed before: any write to the target, a walk beyond the budget, sending
captures to a hosted model, accepting (committing) the model, and `render --force`. Do not
proceed on silence.

## Report

First line `Outcome:`. Then the evidence counts, slices with decisions, run command and result,
the fidelity table, open unknowns and what was not verified.

The skill carries the detail; do not duplicate it here.
