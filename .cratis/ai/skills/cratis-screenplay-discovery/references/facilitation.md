# Facilitation

## Stance

- Help people say what happens in their business; do not teach event modeling unless asked.
- Use their words in names and descriptions. Correct a name by writing the better one into the
  model and mentioning it in the change report, not by explaining why theirs was wrong.
- Keep the conversation about the business. Databases, APIs and frameworks are out of scope
  during discovery; park them in STATE.md if they come up.
- Breadth before depth: a rough map of the whole domain first, then one workflow at a time.

## Filtering without friction

When someone offers a non-event, ask what changed because of it. "When the harbourmaster
looks at the waiting list, does anything get decided?" If the answer names a decision, model
that decision. If not, note the need as a view and move on.

## Disagreement

- When people describe the same step differently, first check whether they describe different
  situations (two branches, two roles). Often both are right.
- If it is a real disagreement, write both versions as an open question in STATE.md, take one
  as the working assumption (say which), and continue. Do not stall the session on it.
- Domain experts decide business meaning; engineers decide feasibility. When only engineers
  are present, mark business-meaning decisions as assumptions to confirm.

## Group sessions

- Ask the quieter participants directly about their part of the process.
- Treat a sceptic's objection as a likely failure path: write it down as a question, not a disagreement.
- Let idea-generators run, capture everything, and sort afterwards; do not slow the momentum
  with filtering in the middle of their stream.
- Someone who dominates: thank them, capture the point, and turn to the others for theirs.
- For a live workshop with people in a room, use `human-workshop.md`.
- Timebox broad discovery; deep dives happen per workflow.
- Read the event list aloud in story order at checkpoints; gaps are easier to hear than see.

## Unattended runs

- Never block on a question. Take the most reasonable assumption, record it in STATE.md with
  why, and mark it in the feature `description` when it shapes the model.
- Prefer assumptions that keep the model honest (fewer, clearly named facts) over ones that
  invent detail.

## Evidence and privacy

- Do not paste production data, customer records or personal data into hosted models or
  sub-agents without the user's approval. Use invented examples in the model and in
  specifications.
- Classify personal data on the concept as soon as it shows up.

## Closing a session

1. Validate the model (`--warnings-as-errors`).
2. Summarise: workflows covered, events added or renamed, personas, what was set aside.
3. List open questions with the one that blocks progress first.
4. List assumptions taken.
5. Per workflow give the happy path, the decision points and the terminal facts in a few lines.
6. Propose the next step: the next workflow, or `cratis-screenplay-slice-design` for this one.
7. Update STATE.md (phase, status, carry-forward); keep durable rationale in model
   `description` text, which is rendered and queryable; `//` comments survive printing at
   Screenplay v4.64.0, but check the dropped-comments report after any edit that cannot retain them.
