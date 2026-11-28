---
name: cratis-modeling-discover-timeline
description: Use when a business request or story needs an agreed timeline of actors, facts and open decisions. Not for cutting an agreed timeline into slices (use cratis-modeling-design-event-model).
---

# Discover the business timeline

If the starting point is code, [trace existing behavior](../cratis-modeling-trace-existing-behavior/SKILL.md). If it is a recording, recover intent (`cratis-screenplay-recover-intent` skill in `cratis/screenplay`; needs the Screenplay CLI). For a business request such as “register authors,” start with the story rather than the implementation.

1. **Ask for one completed instance.** “Think of the last time you did this. What started it? Who cared about the result, and how did they know it was done?” Use the owner's words. A supplied document is a starting account, not confirmation of a rule.
2. **Collect facts before ordering them.** Ask what became true during that instance. Write candidate facts in the past tense: “author registered,” not “register author.” Keep questions separate. Broaden the account only when another fact or outcome distinguishes a path that matters to the owner.
3. **Put the facts in story order.** Ask which earlier fact made each later step possible. Mark independent steps that can overlap or happen in either order. Where outcomes differ, note the condition that selects the branch, or mark it unknown. Story order implies neither a single transaction nor guaranteed order across histories.
4. **Fill in what happened between facts.** What did the person know or see, what did they request, and what did they see next? If nobody acted, name the trigger, such as a schedule or an outside notification. Distinguish the request from its outcome: pressing a button does not establish a business fact.
5. **Locate each fact.** Name the business boundary that owns its meaning and the specific instance whose history changes (the event source ID). The caller need not be that instance. Look for changes in vocabulary or decision authority, not database tables, pages or reporting lines. One storyline can cross several features.

Before calling the story complete, ask what else can start it, who can change their mind, what can fail or time out, and what happens on a repeat or after the apparent end. For each material branch, record a fact, a question, a deliberate exclusion or why it cannot occur. Separate stated rules from inference and assumptions. Preserve thresholds and deadlines verbatim with their source; present contradictions to the owner rather than averaging them.

## Read back the timeline

Keep it short: actor or trigger, intent, fact, address, observed result and unresolved branches. For example:

> A librarian requests `RegisterAuthor` for Aster, author ID `11111111-1111-4111-8111-111111111111`. Library records `AuthorRegistered` in that author's history. The librarian sees Aster in the authors list: the row has the same ID as the event source and its name comes from `AuthorRegistered.Name`. Open: what should happen if the librarian submits a blank name?

Read the story back to the decision owner (the requester unless they name someone else). Ask which parts they confirm and batch the remaining questions; use the [discovery questions](references/discovery-questions.md) when a missing decision changes the story. Keep disputed branches open. If asked to proceed provisionally, name the assumptions and what remains unaccepted; do not treat a draft or your judgment as agreement.

Take the agreed path and its open branches to [design the event model](../cratis-modeling-design-event-model/SKILL.md). Agreement on the example settles domain intent, not permission to execute.
