---
name: cratis-screenplay-automations-and-translations
description: "Model Screenplay Automation and Translate slices: when a reaction is warranted, todo-list work queues, produces versus invokes, the trusted actor behind caller-less invokes, termination, clock and trigger occurrences, outside facts via capture with correlation, dedup and enrich/ignore/infer, recovery ownership, and what once-only does not prove about external effects. Use when a model has or needs 'when X happens then ...', schedules, work queues, webhooks, API polls, message feeds or imported events. Not for: reaction, trigger or capture grammar (use `cratis-screenplay-captures-and-reactions`)."
license: MIT
---

# Automations and translations

## Purpose
Decide which work the system does on its own, which outside facts it accepts, and what is
protected, recorded or acted on. Write `Automation` and `Translate` slices; grammar is in
`cratis-screenplay-captures-and-reactions`.

**Translation crosses an application boundary:** private-to-private follow-up is Automation,
even if realized by a reactor. Keep captures in Translate and local-fact reactions in separate Automation slices.
Read [public events and direction](references/public-events-and-direction.md) for direction, folds,
publication, ESM v9 forms, PLAY0616 and directionless Translate's PLAY0694 split boundary.
Requires Screenplay 4.176.0 or later (`screenplay --version`) for PLAY0694; older compilers leave that directionless shape unchecked.
One `source events` capture reads one origin (event store); split several origins.
Requires Screenplay 4.155.0 (`screenplay --version`) for PLAY0687; older tools leave it unchecked.

Model behavior first; code implements external calls, adapters, actors and refused targets.
Follow `cratis-screenplay-modeling-lifecycle` for session discipline and `cratis-screenplay-toolchain` for verdicts.
Settle input, identity, effect and pending-work contracts per reaction/capture, not at final review.

## Tool and realization facts (read before promising anything)
- V1, V3, V4 and target rendering are separate; name the compiler and never remove
  a refused construct. Run `screenplay test` or MCP `run-specifications` for V4.
- Read [realization and gap-fill](references/realization-and-gap-fill.md) before
  promising Automation/Translate delivery (STAGE-ESM-024).
- Invokes have no caller without `runs as`. Read captures-and-reactions
  [invocation identity](../cratis-screenplay-captures-and-reactions/references/invocation-identity.md)
  for the ESM v10 actor and role/authenticated versus claim/opaque admission.

## Atomic production boundaries and source identity

Start new models with `reaction batches atomic` at application root (ESM v22).
Each trigger's direct productions and each selected refusal branch are separate all-or-none
batches; commands remain independent. Absence keeps legacy per-fact behavior at later versions.
Assert no failed-batch facts and unchanged views, not only `then error`. Stage 4.139.0 admits v22
(earlier: -016), but atomic mode stays gap-fill (STAGE-ESM-043).
Read [atomic batches and source mappings](../cratis-screenplay-captures-and-reactions/references/atomic-batches-and-source-mappings.md)
for boundaries and `$eventSourceId` / `$eventContext.eventSourceId` invocation mappings.

## Effect guarantees and recovery traps
| Guarantee | What it promises | What can show it |
|---|---|---|
| **once-only fact** | `CertificateSent` exists at most once for an enrolment | `constraint … unique event` on the right stream + a violation spec |
| **idempotent handling** | asking again gives the caller the same outcome, no new effect | target behaviour (map "already has the event" to success where intended); the model shows a rejection |
| **exactly-once external effect** | the person receives one certificate, the card is charged once | nothing in the model; only the outside system's dedup or a reconciliation can |

A todo list + reaction + unique constraint proves the first, not the third: the send can succeed,
the append fail (crash, lost reply, constraint race), and retry sends again.
- Cascades are not one transaction: earlier facts stay after a later command rejects. Make each step retryable.
- Read [effect guarantees](references/effects-and-idempotency.md) for redelivery, `then no events`
  and refusal disposition; execution is not external deduplication.
- Chronicle `[OnceOnly]` skips replay (rewind, redaction, revision), not ordinary catch-up,
  same-source events or crash redelivery. Recovery runs normally: no per-source run limit or dedup.
  Identify retries with a `ReactorDelivery.Id` receipt. Name replay and recovery behavior separately.

## Capture data-protection traps
Omission from `map` is not redaction: the field still passes through the working record.
Check every append mapping/event property; record whether raw or last-seen source records are stored and minimized.
Personal data in events needs bare `pii` on its concept and a purpose (command-surface `references/compliance.md`);
keep the marker even when binding blocks. Never record bearer tokens, magic links or signed URLs as facts
(a keyed hash or reference at most), or put PII on the event-source id.

## Product sources
Read [product sources](references/product-sources.md) to check Screenplay, Stage, Arc or Chronicle claims.
Minimums: Screenplay 4.125.0 for `runs as system role` (ESM v10), 4.105.0 for list queries
(`=> Item[]`; earlier: PLAY0268), 4.124.0 for `--check privilege` (PLAY0652).
Arc requires 20.56.0 for `[ExecuteCommandsAsSystem]`, 22.72.0 for mixed event/command returns.
Stage still refuses mixed `produces`/`invokes` (STAGE-ESM-037); keep authorized gap-fill.
Select tools through `cratis-screenplay-toolchain`; read `screenplay --version` and
`cratis --version`. Reverify before claiming another version behaves the same.

## Inbound capture source contract

When shipping sources both events by `orderId`, the inbound
[ShipmentTracking example](references/public-events-and-direction.md#inbound-event-captures)
may declare the promise explicitly:

```screenplay excerpt
capture ShipmentTracking
  source events
    from ShipmentDispatched
    from ShipmentDelivered
  key orderId is event source
```

This needs Screenplay 4.242.0 and ESM v33. Explicit fixture `for` must equal the key;
without `for`, it takes the key before reactions/projections. Unmarked captures stay unchanged.
Other sources or non-single-property keys report PLAY0809, with no automatic repair.
Read [event-source keys](../cratis-screenplay-captures-and-reactions/references/event-source-keys.md) for the complete model and rejection cases.

## When / when not
- Use: "when X happens, then ...", schedules, retries, work queues, notifications, webhooks, APIs,
  files or message feeds, events imported from another context, legacy sync.
- Not for: grammar (`cratis-screenplay-captures-and-reactions`), identity/invariants (`cratis-screenplay-streams-and-consistency`),
  UI `on click` (`cratis-screenplay-ui-composition`) or hand-written reactors (`cratis-chronicle-reactor`).

## Interview phase
**Skip if** sources, record types, sanitized samples and correlation are known, plus each
automation's occurrence, effect and actor. Cite existing answers. Surface missing correlation first.

Read [integration interview prompts](references/integration-interview.md) when
sources, mapping, automation ownership or recovery are unsettled. Ask one group at
a time; treat "unsure" as an open question.

**Unattended:** record assumptions as labelled open decisions in
`.ai-work/screenplay/<model-slug>/STATE.md` and mark dependent slices open; never write a mapping
or actor that nobody confirmed. Read [worked integration](references/worked-integration.md) for an interview and recovery example.

## Procedure
1. **Inventory.** List every reaction, trigger and external source/type in scope; read their
   declarations, mappings, descriptions and specs. For integrations resolve only the unknowns
   (`references/integration-contracts.md`).
2. **Is it an automation?** Write four lines: occurrence (event, clock, application trigger), state
   consulted, condition, effect. Always fires, consults nothing, cannot fail, touches nothing outside:
   co-production, the command produces both facts. Otherwise continue (`references/automation-patterns.md`; a process with waits, approvals, compensation or fan-out: its §10).
3. **Queue or direct?** A todo list (a read model whose membership is the pending work) when work can
   wait, retry, fail or need people. Name each opening and closing fact (result, cancellation,
   supersession), the work-item key and the recovery path. Direct reaction only for an immediate,
   internal, always-possible effect; say why no pending state is needed. A translation is not
   automatically infallible.
4. **Effect and actor.** `produces <Fact>` records a fact; `invokes <Command>` requests a decision.
   Keep its gate; declare reaction `runs as system role "<Role>"` (ESM v10), otherwise caller-less.
   CLI/Stage realization is separate. Returned-command reactors use `[ExecuteCommandsAsSystem("<role>")]`
   and the matching policy; without the attribute Arc supplies no principal and `[Authorize]`/`[Roles]` deny.
   Never strip a gate or invent identity through `given caller`. `runs as` covers returned/invoked commands,
   not imperative pipeline calls, reads, productions or causation. Run `--check privilege --warnaserror`
   (PLAY0652): every trigger-event producer must require **all** declared system roles.
   Ungated commands/captures/reaction productions warn; opaque gates are information, not proof.
   An OR alternative does not require a role. Clock/application triggers have no producer and are silent;
   still review trust.
5. **Trace inputs.** Every trigger value, command input, event property and destination needs a
   supported source; every filter a business reason. Gaps are questions, not invented mappings.
6. **Repetition and termination.** Identify one logical work occurrence and what a retry is. Guard the
   result fact with `constraint ... unique event` on the right stream only when once per source is the
   rule. Name what ends each chain and check cycles. Answer separately how the *external* effect avoids
   repeating and how replay differs from recovery redelivery (`references/effects-and-idempotency.md`).
7. **Translate outside facts** (`references/translation-patterns.md`): enter only via `capture` or a
   translator reaction, in a `Translate` slice; correlate first; keep the external fact distinct from
   ours; trace source fields *and* every required target field; decide dedup, ordering and recovery
   ownership. A reaction to a capture's local fact is a separate Automation, not a
   second job inside Translate. A worker after translation needs a distinct local decision, obligation or effect.
8. **Specify and audit.** Work through `references/cases-to-specify.md` per declaration and hand the
   named cases to `cratis-screenplay-scenario-coverage`. Produce the audit in `references/audit-format.md`.

## Rules
**Compiler contracts** (diagnostics)
- No inline `produces event` in a reaction (PLAY0474); declare reaction-produced events in the slice.
- Effects sit under triggers; `description`, `where` and `runs as` are reaction-level. One `where` (PLAY0252); no repeated trigger (PLAY0253).
- Clock triggers take no values (PLAY0450) or `by` on reads (PLAY0443). `for each <View>` is reserved.
- Capture `when` cannot mix `and` and `or` (PLAY0089). A capture without `key` does not bind.
- For `source events`, `key` is a required property on every `from` event (PLAY0700);
  specs supply `given <Event>` / `when append <Event>`, not capture records (PLAY0701).
- First sight is `added` only; use a separate `when added`. Seed record updates with same-key `given capture`;
  captures-and-reactions `references/record-capture-specifications.md` covers prerequisites and child/nested rules.
- V1 warns on undeclared capture/removal events (PLAY0166); V3 is separate.
- Trigger `reads` with direct `produces` fails binding: decide in a command. Only admitted command reads
  protect under `command reads protected` (v25). Stage 4.138.0 renders Arc read protection; older CLI bundles
  (including CLI 3.75.0) refuse STAGE-ESM-044. Semantic execution is not generated-app protection.
- An authorized command spec without `given caller` is PLAY0389 at binding.
- List queries (`=> Item[]`) bind; snapshots are not rendered (STAGE-ESM-010). Clock sweeps need
  code bodies the reference does not run (`references/todo-list-example.md`).

**Modeling defaults** (deviate with a recorded reason)
- `produces` without `for` uses the triggering fact's source; clock/trigger occurrences have none: give `for` (carried value or literal).
- `where` guards every trigger and must resolve from each trigger's values: give clock sweeps their own reaction.
- Malformed or unmappable input becomes a recorded failure fact or dead-letter view, never a dropped
  record. A fan-out records one outcome per item; partial success is failure at an effect boundary
  (`cratis-engineering-effect-boundaries`), never a batch "done" while members failed.
- Infrastructure (logging, caching, retries, outbox plumbing) is never a Translate slice.
- Personal data kept in events needs `pii` on its concept; keep it even when it blocks binding or render.
- Code bodies (`file`, inline fences) document realization; no local engine runs them.

**Review questions**
- What stops this from running twice? Forever? When the external call times out?
- Who is the actor, and could an outsider reach the invoked command?
- What does a person see while the work is pending or failed?
- What happens if the outside fact arrives before ours, twice, out of order, or changed?

## Gate
Audit every affected reaction/capture with location and result of complete, open or blocked
(`references/audit-format.md`); name unreviewed scope. Open decisions and target requirements belong
in `STATE.md`. A missing required/referenced queue opening or closing fact is unresolved, never skipped silently;
a direct effect states "not applicable: no queue" with its reason. Use the audit's per-chain questions.
Never report a verdict without the tool and version that produced it.

## Verify
- Name tool/version for V1/V3 per `cratis-screenplay-toolchain`; before v6 report "V3 blocked: PLAY0268 (ESM v6)".
  Admitted V4 uses `screenplay test`/MCP; unsupported or unbound is not passed.
- Each external source/type has a translation or out-of-scope reason; check target fields and source dispositions.
- Cite specs or missing cases for each branch, denial, competing claim and closing event; one happy path is not coverage.
- Every complete example compiles. Read `references/todo-list-example.md` when modeling a pending-work automation (its design-only excerpts insert into `assets/pending-certificates.play` and `assets/retry-sweep.play`), and `references/translate-example.md` when modeling capture plus translator reactions.

## Routing and lineage
Read [neighbouring skills](references/neighbouring-skills.md) for grammar, streams, specs, rendering, legacy writes or reactors;
read `references/provenance.md` for sources, adaptations, attribution and approaches deliberately not adopted.
