---
applyTo: ".ai/skills/**,engineering/**,skills/**"
paths:
  - ".ai/skills/**"
  - "engineering/**"
  - "skills/**"
---

# Engineering recipe skeleton

A recipe (a skill that walks someone through a procedure) answers the same five questions
every time, in the same order, so a reader can find the one they came for without reading
the whole page. Every line is tagged **[contract]** (binding) or **[convention]** (the
house default) per the Three Levels of Authority in [`general.md`](./general.md).

## The five sections

- **[contract] When you need this.** The situation that brings someone here, stated as a
  situation and not as a feature name. First, so a reader can leave immediately.
- **[contract] When you do not.** The neighbouring situations and where each one goes
  instead, by name. A recipe with no exits gets applied to work it does not fit.
- **[contract] Steps.** Numbered, in order, each one an action with an observable result.
  A step whose result cannot be observed belongs in the prose above the steps.
- **[contract] What breaks.** The failure modes this procedure actually produces, and the
  symptom each one shows. Not a generic troubleshooting section.
- **[contract] How it is proven.** The signal that says the procedure worked *this time* —
  the command, the gate, the observed behavior. See
  [`verification-discipline.md`](./verification-discipline.md).

## Rules for the page

- **[contract] The five sections appear in that order and none is omitted.** A section
  with nothing to say says so in one line; deleting it hides the gap.
- **[contract] A recipe refines rules; it never contradicts one.** On conflict the rule
  wins and the recipe is the artifact to fix — see the Source-of-Truth Discipline section
  in [`general.md`](./general.md).
- **[contract] Every example is real.** Copy it from source that exists, and say where it
  came from; see [`writing-correct-examples.md`](./writing-correct-examples.md).
- **[convention] One recipe, one procedure.** Two procedures that merely share a topic
  are two recipes with cross-links.
- **[convention] Keep it under one screen per section.** A step list that scrolls is
  usually two recipes.
- **[convention] Name the exits by skill or rule name**, not "see elsewhere" — a reader
  who has to search does not.

> A recipe that is graded by a tracked evaluation is pinned by digest. Restructuring it
> changes the text the evaluation graded, so realign it in the same change that re-runs
> and re-pins that evidence — never on its own.
