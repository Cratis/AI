---
name: cratis-screenplay-automations-and-translations
description: "Model Screenplay Automation and Translate slices: when a reaction is warranted, todo-list work queues, produces versus invokes, the trusted actor behind caller-less invokes, termination, clock and trigger occurrences, outside facts via capture with correlation, dedup and enrich/ignore/infer, recovery ownership, and what once-only does not prove about external effects. Use when a model has or needs 'when X happens then ...', schedules, work queues, webhooks, API polls, message feeds or imported events. Not for: reaction, trigger or capture grammar (use `cratis-screenplay-captures-and-reactions`)."
license: MIT
---

# Automations and translations

## Purpose
Decide which work the system does on its own, which outside facts it accepts, and what that work
guarantees. Then write it as `Automation` and `Translate` slices that say truthfully what is
protected, what is only recorded, and who acts. Grammar depth is in
`cratis-screenplay-captures-and-reactions`; this skill owns the decisions.

**One meaning of Translation:** outside data becomes our facts (a `capture` or a translator
reaction over an imported event, in a `Translate` slice). Our own event-to-event follow-up is an
Automation (`produces` or `invokes`), even when a Chronicle reactor realizes it.

Work in the model first. Code appears only where it is truly needed: the external call, the
source adapter, the trusted actor, and everything Stage cannot render (below). Session and
verdict discipline: `cratis-screenplay-modeling-lifecycle`; tools, versions and verdicts V1 to V5:
`cratis-screenplay-toolchain`. When you add or change a reaction or capture, resolve its input,
identity, effect and pending-work contract at that point; do not postpone it to the final review.

## Tool and realization facts (read before promising anything)
- Reactions, clocks, triggers, captures and Automation/Translate slices compile (V1) and bind (V3)
  on Screenplay 4.61 or later: the standalone tool and the cratis CLI 3.28.2 or later (bundled
  4.66.0). Probed on 3.28.2: the complete examples are `executableReady`. A cratis bundle before 3.28.2
  (4.60.1) reports PLAY0268 at binding: report "V3 blocked: PLAY0268 (ESM v6)" and
  name the tool, never remove them.
- No MCP tool, `validate` or render runs Automation or Translate specs. V4 is "not run: no route".
- Stage 4.24.2 (bundled in cratis 3.28.3) renders no Automation or Translate slice (Stage#79); `cratis render` refuses the whole v6 model with STAGE-ESM-016: the whole automation is
  gap-fill or hand-written delivery with the model as contract (`references/realization-and-gap-fill.md`).
- Invoked commands run with no caller; `.play` cannot name an actor (Screenplay#383).

## Verified product sources
| Package | Version | Used for |
| --- | --- | --- |
| Screenplay | v4.66.0 (`c89198b`) | `Documentation/screenplay/{reactions,captures,triggers,specifications,diagnostics}.md`; examples compiled with the standalone tool |
| cratis CLI | v3.28.3 | bundles Screenplay 4.66.0 and Stage 4.24.2 (before 3.28.2: 4.60.1, which gave PLAY0268 on v6 constructs and a false PLAY0285 on cascades, cli#242) |
| Stage | v4.24.2 | admits ESM v1 to v4; renders no Automation or Translate slice |
| Arc | v22.50.5 | `ExecuteCommandsAsSystemAttribute` (since v20.56.0) |
| Chronicle | v19.32.0 | `OnceOnlyAttribute`, `ReactorDelivery` and `Documentation/reactors/delivery-identity.mdx` |

Full pin table: `cratis-screenplay-toolchain` `references/versions.md`. Reverify before claiming
another version behaves the same.

## When / when not
- Use: "when X happens, then ...", schedules, retries, work queues, notifications, webhooks, APIs,
  files or message feeds, events imported from another context, legacy sync.
- Not for: reaction, trigger or CDL grammar (`cratis-screenplay-captures-and-reactions`); stream
  identity and invariants (`cratis-screenplay-streams-and-consistency`); UI interactions such as
  `on click` (`cratis-screenplay-ui-composition`); hand-written reactors (`cratis-chronicle-reactor`).

## Interview phase
**Skip if** the user already gave: every external system with its record types, a sanitized sample
of each, and how each record finds our entity (the correlation strategy); and for automations, the
occurrence, the effect and who acts. Cite existing answers instead of asking again. Missing
correlation is the most common cause of failed integrations: surface it first.

**Critical questions** (ask one group at a time; follow up from the answer; accept "unsure" as an
open question, not an invented answer):
1. **Sources.** "Which systems send us facts? For each: name, record types, channel (webhook, poll,
   topic, file), format, who authenticates it?" Follow-up per system: "Does the record carry our
   entity id, or do we need to remember their id against ours?"
2. **Mapping.** "For the hardest record: does it map directly to one fact of ours, need several
   facts, or need data we already hold?" Follow-up if not direct: "What do we look up, and what
   happens when the record arrives before that data exists?"
3. **Automations.** "What happens on its own after <fact>? Can it fail, wait, or need a person? What
   do people see meanwhile? Who is allowed to do it?" Follow-up: "What makes it stop? What if it ran
   twice?"
4. **Recovery.** "Which records or steps can we not accept, and who fixes them, how, and how does
   processing resume?"

**Unattended:** assume visibly. Record each assumption as a labelled open decision in `STATE.md`
(`.ai-work/screenplay/<model-slug>/STATE.md`), mark the dependent slice open, never write a mapping
or actor that nobody confirmed. Transcript-shaped worked example: `references/worked-integration.md`.

## Procedure
1. **Inventory.** List every reaction, trigger and external source/type in scope; read their
   declarations, mappings, descriptions and specs. For integrations resolve only the unknowns
   (`references/integration-contracts.md`).
2. **Is it an automation?** Write four lines: occurrence (event, clock, application trigger), state
   consulted, condition, effect. Always fires, consults nothing, cannot fail, touches nothing outside:
   co-production, the command produces both facts. Otherwise continue (`references/automation-patterns.md`).
3. **Queue or direct?** A todo list (a read model whose membership is the pending work) when work can
   wait, retry, fail or need people. Name each opening and closing fact (result, cancellation,
   supersession), the work-item key and the recovery path. Direct reaction only for an immediate,
   internal, always-possible effect; say why no pending state is needed. A translation is not
   automatically infallible.
4. **Effect and actor.** `produces <Fact>` when nothing should refuse the fact. `invokes <Command>`
   when the step is a decision that may reject; it carries **no caller**, so gated commands reject it.
   Record one actor decision: internal ungated command (only when safe and unreachable), direct
   `produces`, or gated command with a trusted actor and the capability gap (Screenplay#383). The code
   realization of the actor is a reactor with `[ExecuteCommandsAsSystem("<role>")]` and a policy
   requiring that role; never invent `runs as`. Never strip authorization to pass a tool.
5. **Trace inputs.** Every trigger value, command input, event property and destination needs a
   supported source; every filter a business reason. Gaps are questions, not invented mappings.
6. **Repetition and termination.** Identify one logical work occurrence and what a retry is. Guard the
   result fact with `constraint ... unique event` on the right stream only when once per source is the
   rule. Name what ends each chain and check cycles. Answer separately how the *external* effect avoids
   repeating and how replay differs from recovery redelivery (`references/effects-and-idempotency.md`).
7. **Translate outside facts** (`references/translation-patterns.md`): enter only via `capture` or a
   translator reaction, in a `Translate` slice; correlate first; keep the external fact distinct from
   ours; trace source fields *and* every required target field; decide dedup, ordering and recovery
   ownership. A worker after translation needs a distinct local decision, obligation or effect.
8. **Specify and audit.** Work through `references/cases-to-specify.md` per declaration and hand the
   named cases to `cratis-screenplay-scenario-coverage`. Produce the audit in `references/audit-format.md`.

## Rules
**Compiler contracts** (diagnostics at 4.66.0)
- No inline `produces event` in a reaction (PLAY0474); declare reaction-produced events in the slice.
- Effects sit under a trigger; only `description` and `where` are reaction-level; one `where` per
  reaction (PLAY0252); a trigger may not repeat (PLAY0253).
- Clock triggers take no values (PLAY0450) and no `by` on reads (PLAY0443). `for each <View>` is
  reserved, not available.
- Capture `when` cannot mix `and` and `or` (PLAY0089). A capture without `key` does not bind.
- Undeclared events in capture `append` and `remove with` pass V1 and fail only at binding (V3, PLAY0273): run V3.
- A trigger with `reads` that `produces` directly fails binding: decide in a command. `reads` never protects.
- An authorized command exercised in a spec without `given caller` is PLAY0389 at binding.
- A list query (`=> Item[]`) and a clock sweep that iterates items do not bind; show them only as marked
  design-only excerpts (`references/todo-list-example.md`).

**Modeling defaults** (deviate with a recorded reason)
- A `produces` without `for` lands on the triggering fact's source; clock and trigger occurrences have
  none, so give `for` (a carried value or a literal).
- `where` guards every trigger of the reaction and must resolve from each trigger's values: give a clock
  sweep its own reaction.
- Malformed or unmappable input becomes a recorded failure fact or dead-letter view, never a dropped
  record. A fan-out records one outcome per item; partial success is failure at an effect boundary
  (`cratis-engineering-effect-boundaries`), never a batch "done" while members failed.
- Infrastructure (logging, caching, retries, outbox plumbing) is never a Translate slice.
- Personal data kept in events needs `@pii` on its concept; keep it even when it blocks binding or render.
- Code bodies (`file`, inline fences) document realization; no local engine runs them.

**Review questions**
- What stops this from running twice? Forever? When the external call times out?
- Who is the actor, and could an outsider reach the invoked command?
- What does a person see while the work is pending or failed?
- What happens if the outside fact arrives before ours, twice, out of order, or changed?

## Gate
Not done until, for every affected reaction and capture, there is a line in the audit
(`references/audit-format.md`) with a location and a result of complete, open or blocked, and any
unreviewed scope is named. Open decisions and target requirements are in `STATE.md`. A missing required or
referenced queue opening or closing fact is an unresolved dependency, never skipped silently; a
direct effect states "not applicable: no queue" with its reason (per-chain questions in
`references/audit-format.md`).
Never report a verdict without the tool and version that produced it.

## Verify
- V1 and V3 per `cratis-screenplay-toolchain`, each with tool and version. On a cratis before 3.28.2
  bundle report "V3 blocked: PLAY0268 (ESM v6)"; on 4.66.0 (standalone or cratis 3.28.2) these slices bind. V4 is "not run: no route" for these slices.
- For each external source and type: its translation, or an explicit out-of-scope reason; check
  target-field completeness as well as source-field dispositions.
- One happy path is not coverage: cite the spec or the missing case for each branch, denial, competing
  claim and closing event.
- Every complete example compiles: `references/todo-list-example.md`, `references/translate-example.md`.

## Route near misses
- Grammar: `cratis-screenplay-captures-and-reactions`; invoked commands: `cratis-screenplay-command-surface`;
  triggers versus UI interactions: `cratis-screenplay-ui-composition`.
- Stream identity, constraints, races: `cratis-screenplay-streams-and-consistency`.
- Specifications for these slices: `cratis-screenplay-scenario-coverage`, then `cratis-screenplay-specifications`.
- Rendering, gap-fill and delivery route: `cratis-screenplay-render-and-gap-fill`.
- Legacy database-only writes: `cratis-screenplay-legacy-extraction` classifies them first; not
  automatically Translate.
- Hand-written reactors and replay semantics: `cratis-chronicle-reactor`.

## Lineage
Sources, adaptations and attribution: `references/provenance.md`.
