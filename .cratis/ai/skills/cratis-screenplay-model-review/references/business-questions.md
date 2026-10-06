# Business-question pass (explain brief)

Purpose: before acceptance (P6), find the decisions only a domain person can make, and put them
so that person can answer without learning modeling. The method follows Event Modeling's idea
of information completeness (every decision has the information it needs, every recorded fact
comes from somewhere and is used somewhere) and specification by example (agree behaviour
through concrete cases). It walks the model the way the business lives it: one persona at a
time, along the timeline.

## Ground rules
- **Anchor.** Each question points at one place in the model (a step, a screen, a recorded
  detail, a rule) and uses the business words written there. If you cannot point at it, drop
  it.
- **Decide, not inform.** Ask only what changes the model depending on the answer. If the
  model already answers it, or the critic report already lists it as a defect, leave it out.
- **No answer inside the question.** Open, short, one point each ("What should happen
  when ...?").
- **Silence is a result.** "No open business questions for <scope>" is a complete report.
- **Stay in scope.** Parts of the business not yet modeled are not gaps; mention them once as
  "not yet covered" if the user asked for the whole process.
- **Stay out of engineering.** Storage, speed, ids, timestamps and message delivery are the
  modeler's concerns unless the model shows a business consequence of them.

## Stance
Read the model as a sharp analyst who has not met the domain: curious, direct, someone who has
seen flows like this break in practice (a double click, an unhappy customer hitting the edge
case, unclear ownership). Short questions land better than long ones; one sentence each.
- Ask only about what is genuinely unclear or missing inside the scope you were given. Do not
  second-guess a case the model clearly handles.
- Ground every question in something the model shows (a field, a step, a persona's line). Do not
  invent requirements: raise duplicate handling only where the flow shows a way it can happen.
- A part of the process that has not been modeled yet is not a gap. A missing confirmation
  page, welcome message or list view is a question only when something in the scope clearly
  implies it.
- Identifiers, timestamps, correlation values and versions are modeler concerns, not business
  gaps.
- Never write "no spec", "not modeled", "no actor", "event", "command" or "read model" in a
  question. Ask "What do we expect when ...?", "Who does this?", "What happens if ... fails?".
- At most 12 questions per pass. When more qualify, keep the ones that change the model most
  and list the rest as themes.
- Questions go to the user in the report; they are not written into the model. Where the
  harness shows a board view, a sketch of a relationship or cluster may accompany a question,
  never replace it.

## Method: walk each journey
1. List the personas in scope and, for each, the story they live through the model in time
   order (the stories you would tell the stakeholder; they are the "Flows read" line).
2. Walk one story at a time. At each element the person meets, try the prompts for that
   element below. Record a question only when it passes the ground rules.
3. Then walk the work nobody starts by hand (reactions, schedules, news from other systems).
4. Merge duplicates across stories; keep the first place a person would notice the issue.

### The person (personas, gates)
- Is this the person who really does it, or do they act for someone else? Must the business
  know who acted for whom?
- Who can look at this but must not change it, and does the story show that?

### What they look at before deciding (screens, read models, queries)
- When they make this choice, can they see everything they need to choose well? What would
  they otherwise phone or email someone about?
- Is anything shown here stale or missing at the moment they decide (because it arrives later
  or from another team)?
- Does this screen answer one question for them, or several they would ask separately?

### The decision (commands, rules, constraints)
- Which situations make the business say no here, and what does the person need to be told?
  Ask for one concrete refusal example per rule that lacks one.
- What must already have happened, and what must not have happened yet, for this to be
  allowed? What about after the story has ended (closed, cancelled, expired)?
- If two people try this at the same moment for the same thing, who wins, and what does the
  other one see?
- Only when the story shows a way it can happen (a person can press again, another party can
  resend): what should a second identical attempt do?

### What becomes true (events and their details)
- Is what we record here the business decision itself, in the words the business uses?
- Does a later step, report or another team need a detail that is only known right now?
- Can this be undone, corrected or reversed later? Who may do that, and is the original kept?
- Does one action here settle several things that could, in real life, happen separately?

### Work without a person (reactions, todo lists, schedules, other systems)
- What starts this automatically, and who is accountable for what it does?
- What if the other party says no, never answers, or answers twice?
- Is there a deadline, expiry or recurring moment here? What happens exactly when it passes,
  and does the business want a record that it passed?
- Does the order matter? What if the later thing is heard about before the earlier one?

### Agreeing by example (specifications)
- For a rule or boundary with no example yet, ask for the smallest concrete case: the values,
  and what the person should see ("a boat exactly as long as the berth").
- Where only the smooth path has an example, ask what should happen in the one edge case the
  details make obvious (an empty value, the same thing twice, after it was closed).
- Is there a life story here (started, active, paused, ended) that the steps imply but never
  say? What may still happen after the end?
- Where examples disagree with what an expert says, ask which one is right.

## Translating model words
Say what the person experiences, using the names in the model's descriptions and persona
purposes. Keep Screenplay vocabulary out of the question.

| In the model | In the question |
|---|---|
| event, `produces`, generation | "is recorded", "what we write down when ..." |
| command, `invokes` | "when <person> asks to ...", "does ..." |
| read model, projection, query, screen | "the list / overview / page showing ..." |
| module, feature, slice | "this part of the process", "this step" |
| specification, given/when/then, scenario | "for example, if ..." |
| persona, role, policy, `given caller` | the person's name in the business ("the harbour office") |
| event source, identifier, `for` | "each <thing>", "this <thing>" |
| reaction, trigger, clock, capture, translation | "automatically", "every night", "when <other party> tells us" |
| constraint, `unique`, concurrency, idempotency | "only one", "at the same moment", "again" |
| `validate`, `require`, `then error`, `then denied` | "refuse", "not allowed", "what do we tell them" |
| property, optional, payload | "the details", "if they leave out ..." |
Test each question: could the product owner answer it straight away, without a glossary?

## Output format
```text
# Business questions: <scope>
Flows read: <persona: story in business words; one line each>

1. <Persona, step in business words> - <question>
   Why it matters: <one sentence, business consequence>
2. ...

Themes: <2-3 business themes phrased as questions, or "none">
Next step: <one suggestion, e.g. "walk through cancellations with the harbour office">
```
If nothing meaningful: `No open business questions for <scope>.` plus the flows read.
