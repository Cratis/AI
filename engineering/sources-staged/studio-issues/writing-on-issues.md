---
applyTo: "**/*"
---

# Writing on Issues, and When to Ask a Human

Issues in `Cratis/StudioIssues` are read by people who did not do the work and were not in your context. What you write there is the only thing they see. Two failures matter, and the second is worse than the first.

## Do not narrate your investigation

An issue comment is not a log. The reader wants the current state and what happens next, not the sequence of hypotheses that produced it.

Concretely, the failure looks like this: seven comments over two days, each correcting the previous one, each mentioning a person who has no action to take. The person is @-mentioned every time and asked nothing answerable. Eventually they ask *"is there any input needed from me?"* — which means every one of those notifications was a cost with no return.

**Before commenting, ask what changes for the reader.** If the answer is "they now know I looked at something", do not post. Findings that change nothing yet belong in the internal plan file, not in a public comment.

- **Post a comment when**: the state of the issue changed (diagnosed, fixed, blocked, withdrawn), or you need an answer.
- **Do not post when**: you have progress but no change of state, or you are correcting a detail nobody acted on. Edit the earlier comment instead.
- **Consolidate.** One comment that supersedes your last three is better than three that each qualify the one before.

**Consolidating is retroactive, and editing is free.** Editing an existing comment sends no notification, so a thread that has already sprawled can be collapsed without costing anyone a second interruption: rewrite the first comment as the current state of play, and replace the superseded ones with a one-line pointer to it. Nothing is hidden and the history stays intact, but a reader arriving late reads one comment instead of reconstructing a narrative from ten.

The measure to apply is **what a newcomer has to read to understand the state**, not how many comments exist. One issue in this repository reached **14 comments and 30,000 characters** — seven of them posted in a single day by the agent that was actively working it, each superseding the last. Consolidated afterwards, the same information was 13,000 characters and one current comment. If your recent comments would not survive that exercise, do it before posting another one.

Corrections are mandatory when you were wrong and somebody may have acted on it — but state the correction and its consequence, not the journey. *"I said this was load. It is not; it fails on an idle runner too"* is complete.

## Only @-mention a person for a decision that is theirs

An @-mention is a claim on someone's attention. It is justified when there is a question **only they can answer**, and not otherwise.

**Evidence that the reflex is real, measured on `Cratis/StudioIssues`:** of 23 issues carrying agent-written comments, **20 @-mentioned the same maintainer**. Six of those were triage questions posted on backlog issues on a single day; **none received a reply**, and all six were still open two weeks later. A mention that reliably goes unanswered is not a request — it is noise that teaches the reader to skim past the ones that matter.

Before mentioning anyone, apply these in order:

1. **Can I find this out?** Measure it, read the source, run it. A question you could have answered by looking is not a question. Most "should we do X or Y?" questions are really "I have not checked whether X is possible."
2. **Is it genuinely theirs?** Product intent, priorities, money, access and credentials, and irreversible decisions are theirs. Anything decidable from the code, the measurements, or the existing rules is yours — including which of several correct implementations to use.
3. **Is it answerable as written?** A question referring to something you redacted, or requiring the reader to reconstruct six comments of context, cannot be answered. It will be ignored, and rightly.
4. **Does it block something now?** A decision needed only when an issue is eventually picked up is not needed today. Write it into the comment as an open call for whoever picks it up, and leave the mention off. Backlog triage almost never justifies a ping.

**Replying to someone who already wrote on the issue is different, and always fine.** Answering a direct question, or thanking a reporter for a bug report, is a conversation rather than an interruption. The rule above is about *initiating* a demand for attention.

### The shape of a good question

When you do ask, the comment should be readable on its own, in under a minute:

- **Lead with the question.** Not the background. Someone opening the notification sees the ask first.
- **Give the options concretely**, with what each one implies. Two or three named alternatives beat an open-ended prompt.
- **Say why you cannot decide it** — that is what justifies the interruption.
- **Say what is not blocked.** If you can proceed on other parts meanwhile, say so, so the reply does not feel urgent when it is not.
- **Offer an out.** "If you would rather not, say so and I will do Z instead" is often more useful than the question.

Put the evidence *after* the question, or in a separate comment. Never make someone read a measurement table to find out what is being asked.

## Withdraw questions that turned out not to be questions

If you asked something and then discovered the answer yourself, say so explicitly and withdraw it. Leaving it open means someone is still holding an obligation you have already discharged.

The same applies to a question built on a premise that turned out false. State that the premise was wrong and that nothing is needed — that is a real update and worth its notification.

## A failing check is evidence about the path it exercises

The reasoning error that produces most bad issue comments: treating a failing assertion as evidence about the subsystem you already suspect, rather than about the code path the assertion actually runs through.

Read the path the failing check exercises — the query, the endpoint, the handler — before forming a theory about anything upstream of it. Otherwise you will produce confident, well-evidenced comments about the wrong component, ask for decisions that do not need making, and correct yourself in public repeatedly.
