# 0002 - Event evolution: no migrations, evolve in place, repair production at rollout

Status: Accepted
Related: `/Volumes/Code/Cratis/ai-consolidation-plan.md` Section 5.3 (usage subsystem), risk #2
(event-store compatibility), Section 12.2 ("event type identity"). Direct's and Studio's own
`project/event-evolution-policy-until-further-notice.md`.

## Context

Both donor repositories already have a standing, explicit policy for this, independent of the
consolidation: **no `[EventType(generation: N)]`, no `...V1` records, no `EventTypeMigration<T,
TPrevious>`, anywhere.** Generational registration is racy at rollout (StudioIssues#62). When an event
type's shape changes, gets renamed, or is removed, it is evolved **in place**, and production is
repaired at rollout with a documented scale-down + MongoDB surgery procedure - not replayed through
Chronicle's generation/upcast machinery, and never left as a permanent second event type coexisting
with the first.

This supersedes the plan's own risk #2 framing ("keep replaying the old event types alongside the new
one, or write an explicit migration") - neither option is what this org actually does. It also
supersedes an earlier, incorrect draft of this decision record that proposed leaving
`IssueAgentSessionUsageRecorded` / `LanguageModelUsageRecorded` / `LlmTokensConsumed` alive forever
as permanent parallel event types. That is exactly the kind of migration-avoidance-by-accumulation the
house policy rules out by naming `EventTypeMigration` and generations specifically as forbidden, not
merely "not preferred."

## Decision

1. **`Cratis.AI.Usage.AgentSessionUsageRecorded` is the one event type usage recording produces, from
   day one.** No parallel "old" event type is retained once a product cuts over. `Common.WeekKey`/
   `MonthKey` precomputation at command time (plan Section 5.3b) is carried over unchanged - it is
   already correct, unrelated to this decision.
2. **`[EventType(id: "...")]` gets an explicit, pinned id** on `AgentSessionUsageRecorded` at the
   point it is written (Section 12.2's "event type identity" note - moving a record between
   assemblies keeps its id only if the id was already explicit, renaming does not). The id is chosen
   once here and never changes again without going through step 3's procedure.
3. **At cutover, each product's migration PR (plan PR 14 for Direct, PR 15 for Studio) treats the
   event-shape change as exactly the kind of in-place evolution the house policy already has a
   procedure for**, applied per-store:
   - Direct: retiring `IssueAgentSessionUsageRecorded` and `LanguageModelUsageRecorded` in the
     `Direct` Chronicle store, in favour of the package's `AgentSessionUsageRecorded`.
   - Studio: retiring `LlmTokensConsumed` in the `Studio`/`StudioAdmin` Chronicle stores, in favour
     of the same event.
   - Each follows its own repo's documented steps: merge and let the publish pipeline deploy (the new
     pod crash-loops against the stale schema registry, expected); scale the app deployment(s) to 0,
     then the `chronicle` StatefulSet, since the schema registry is cached in kernel memory and every
     old-schema registrant must be gone; in MongoDB, delete the retired types' documents from the
     store-level `<store>+es.event-types` registry and rewrite/delete their stored events in every
     `<store>+es+<namespace>` sequence collection; scale `chronicle` back up, then the app back to 1
     so it registers the new schema fresh; verify zero `EventTypeSchemaChanged` complaints; restore
     full replica counts.
   - Survey before surgery (both repos' own instruction): enumerate every affected type across every
     namespace/sequence collection up front - a crash only names the first conflict. Back up the
     affected collections before writing.
   - Direct and Studio share the same `chronicle` StatefulSet in `studio-production` (Direct's store
     was moved onto it 2026-09-06, Cratis/Stagehand#507) - a restart briefly interrupts both
     products regardless of which one's schema is being repaired. Coordinate the two cutover PRs so
     this happens once, not twice, if both retirements can land close together; if they cannot, treat
     each restart as a real, if brief, availability event for the other product too and schedule
     accordingly rather than merging opportunistically.
4. **This surgery is executed at the actual cutover PR, against the actual new schema that PR ships -
   never preemptively.** There is nothing to repair before the new event type is merged and deployed
   and a pod is actually crash-looping against a stale registry. Running the scale-down procedure
   before that point has a cost (a real, if brief, availability interruption to a cluster shared with
   the other product) and no benefit.
5. **Historical data is rewritten or deleted, not preserved under two shapes.** Once
   `IssueAgentSessionUsageRecorded`/`LanguageModelUsageRecorded`/`LlmTokensConsumed` documents are
   removed from the registry and their stored events rewritten to the new single-generation shape,
   `Usage/Trends/AgentUsageByWeek`, `Usage/Trends/AgentUsageByMonth`, `Usage/Daily/AgentUsageByDay` and
   `Work/RecordingAgentUsage/IssueAgentResourceUsage` (which stays in Direct, per plan Section 5.3d)
   all project from `AgentSessionUsageRecorded` alone once the affected sequence collections are
   rewritten and Chronicle replays them - no dual-event-type projection logic is needed or wanted.

## Consequences

- The package's usage read models (`Usage/Trends/*`, `Usage/Daily/*`) are written against exactly one
  event type from the start - simpler than the dual-subscription design the earlier draft of this
  record implied, and consistent with how every other read model in both donor repos is written.
- Each product's cutover PR carries real operational weight (a scheduled, coordinated production
  repair, not just a code change) and must say so explicitly in its description, with the survey
  results (which collections, how many documents) attached before the surgery step runs.
- This is why PR 14 and PR 15 in the plan's suggested sequence (Section 10) cannot be "just" a backend
  swap-over: each includes its own event-evolution rollout, following its own repo's documented
  procedure, executed by whoever is running that deploy with real cluster credentials - not something
  to script or automate away, given the shared-cluster blast radius.

## Alternatives rejected

- **Keep the old event types alive forever, dual-subscribe every read model.** This is the earlier
  draft of this record. Rejected: it is not what the house policy asks for (the policy is "evolve in
  place," not "accumulate types"), it leaves permanent dead code in the package's consumers, and it
  under-uses a procedure both repos already document, tested, and are prepared to execute.
- **Use Chronicle's generation/upcast machinery (`EventTypeMigration<T, TPrevious>`).** Explicitly
  forbidden by both repos' policy, independent of this consolidation - generational registration is
  racy at rollout (StudioIssues#62). Not reconsidered here.
- **Run the scale-down procedure now, preemptively, "to get it out of the way."** Rejected: there is
  no stale schema registration to repair yet (the package's event type is not deployed anywhere), so
  the procedure would have a real cost (production interruption on a cluster shared with the other
  product) for no corresponding benefit. It happens at the cutover PR, against the schema that PR
  actually ships, per step 4 above.
