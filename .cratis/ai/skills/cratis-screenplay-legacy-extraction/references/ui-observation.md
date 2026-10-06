# Bounded UI observation

Use this branch when watching a running application answers an extraction question. It is
evidence gathering, not screen redesign and not application testing.

## Before navigating
- Reuse answers already in the brief. Ask only for what is missing: start URL, actor or role,
  target workflow, exclusions, permitted environment, observation budget.
- Check which navigation, page-reading and capture tools exist. Interaction and image tools
  are needed only for the actions and captures the plan uses.
- No tools or no access blocks only this evidence source: record the gap and continue with
  source, document and expert evidence. Never install tools to fill the gap.
- Approval is needed for non-local apps and for any action that writes data or triggers an
  effect (mail, payment, records). A local page can still call production services.
- Use approved test identities and data. Never guess credentials or reuse a token found in a
  URL. Stop on unexpected production data, access boundaries or mutations.
- Follow the disclosure policy from "Ask first" before sending page text or captures to a
  hosted model.

## Walk
1. Follow the named journey first; otherwise sample primary in-scope sections, then their
   meaningful actions. Do not submit a form just to see what happens.
2. Record the state before an approved action and the state after it. Useful states: initial,
   populated, rejected, changed, absent or removed. Other roles or branches only where approved.
3. Tell states apart by actor, workflow and visible state, not by URL. A modal, a denial or a
   changed result at the same URL can be a new observation; a spinner or cosmetic change is not.
4. Sample repeated layouts and pagination once unless their differences answer a named
   question. Skip external destinations and excluded areas.
5. Stop at the budget, the workflow boundary, when no new relevant states appear, or on an
   access or safety blocker. List the paths left over; never call the walk exhaustive.

## Record each meaningful observation
One evidence row (evidence-table-template.md) with:
- stable observation id, actor, environment and observation date;
- redacted route and capture or text locator when one is kept;
- what was visible, how the state was reached, the available actions phrased as intents;
- the before/after difference, including the exact visible rejection text;
- the proposed command, view or event reading, marked as inference;
- the code or expert follow-up needed to establish the rule, authorization or cause.

Keep only what the question needs, under `legacy/captures/`. Redact sensitive values. A
recreated HTML page is a design interpretation, not raw evidence.

## Reconcile
- Group observations into workflows and branches; a page is not a slice boundary.
- Trace each displayed value to a command input, session context, query result or display-only
  derivation. Unresolved origins stay `unknown`.
- A screen proves what was shown, not the server rule, authorization or event behind it.
  Never infer atomic uniqueness, replay behaviour or idempotency from a UI success.
- Pass evidenced updates, removals, denials and branch differences to cratis-screenplay-scenario-coverage.
- Report observed, skipped, blocked and failed paths separately. After a failed capture,
  continue independent safe paths and do not claim the failed one was recorded.
