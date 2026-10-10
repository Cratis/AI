# Traps (one line each, with the fix)

Current pins: Screenplay 4.127.0 / CLI 3.41.0 (`versions.md`). Unless explicitly
updated below, [probed]/[source] rows retain their historical v4.66.0/CLI 3.28.2
scope; negative capability claims there are not current verdicts. Current routes
bind as v8, v7 reaches Stage planning, reference tests have CLI/MCP routes, and
exact numbers are documented in the grammar. Compiler syntax: `cheat-sheet.md`.

1. Clean V1 is not executable: binding errors appear only through MCP (V2) or `render`. Neither `screenplay <folder>` nor `cratis screenplay validate` binds. [probed]
2. The Screenplay samples validate clean but are not all executable; copying their idioms (list queries, `@pii`, `today`, `reads`, `$causedBy`, templates, performers) breaks V3. [probed]
3. Know the target mode (design/executable/renderable) before writing; state it.
4. Plain `produces` without `for` means allocation in the ESM but "the identifier" in rendered code. Always write `for <identifier>`. [PLAY0478 probed]
5. PLAY0029 is a warning: a misspelled keyword (or `type` inside a slice) drops the construct silently. Use `--warnings-as-errors`. [probed]
6. Validate the folder: `cratis screenplay validate file.play` ignores imports and reports false unknown-name warnings (cli#244, open); the standalone tool follows them. [probed on 3.28.2 and 4.66.0]
7. Current V1 warns on absent projection/children/nested targets (PLAY0514) and unknown removal/capture events (PLAY0166). Opt-in field-origins checks find unmapped declared fields (PLAY0534) where coverage is known; still walk lineage for skipped/opaque shapes.
8. Severity does not soften a rule: `severity warning` still rejects the command.
9. Authorization (module AND feature AND construct) runs before validation; unauthorized is `then denied`, never `then error`.
10. Without a declared actor an invocation is caller-less. At 4.125.0 declare reaction `runs as system role "<Role>"` (ESM v10), keep its gate, and reference-test the trusted path. CLI 3.41.0's 4.114.0 parser rejects this syntax (PLAY0137); Stage 4.51.3 audits through v7 only. Arc gap-fill uses `[ExecuteCommandsAsSystem]` for returned commands, not a fictional `given caller`.
11. A reaction `produces` without `for` lands on the trigger's event source; clock and application triggers need an explicit `for`.
12. Read-model identity comes from its keyed queries, which must all use the same `by` property: `query XById => RM optional` + `by xId XId` with `xId` a read-model property, and the identifier equals the projection's effective key (table in slice-design `references/read-model-design.md`; full rule, including Stage's narrower admission and `STAGE-ESM-017`, in `cratis-stage-rendering-and-sandbox` `references/admission.md`). Never mark a read-model property `identifier`. (PLAY0268 when the keyed queries do not share one `by` property; PLAY0351 when a `given`/`then` readmodel block omits that property.)
13. Projection `key` routes only on `from` (projection-level: PLAY0381). `all` is per event source. Joins never create instances and match the joined event's source id. [probed]
14. AutoMap is on by default: same-named event properties fill read-model properties silently (scoped: case-insensitive, same type only; flat-bound: exact name, no type check, so a type mismatch invalidates the model). Use `no automap` for control.
15. `given readmodel` bypasses the projection; prove a projection with `given` events + `when append`/command + `then readmodel`/`then query`.
16. PLAY0285/0286/0287 are static spec checks: do not edit expectations blindly; PLAY0285 had a cascade false positive on the compiler bundled in cratis before 3.28.2 (4.60.1, cli#242); gone in 4.66.0 and cratis 3.28.2. [probed]
17. `null` in specs only for optional read-model properties (PLAY0350); omit the property or record a gap; whether an optional detail is really a separate fact is a review question, not the fix for this code.
18. `then` events are exhaustive and ordered (use `then events in any order` for order only). From ESM v6 they include reaction cascades; after `when append` they list only what followed the append.
19. `reads` without `by` means a singleton view at Screenplay 4.66.0 (decision 0017 will change it); `reads` never binds (PLAY0271), and neither does a command `concurrency` block (PLAY0271, error). [probed, source]
20. Declare each event once, in its producing slice; renaming a persisted event needs `id "OldName"`; renaming a constraint discards its index.
21. Quoted `import "x/*.play"` = my files; unquoted `import Ctx.Event` = another context's contract (does not bind: PLAY0268). [probed]
22. Construct keywords are closed (`aggregate`, `saga`, `workflow` do not exist): PLAY0029 or PLAY0001/0022/0024.
23. `@` escapes are mandatory for `tag`, `authorize`, `produces`, `reads`, `file`, `validate`, `sequence`, `occurred`, `causedBy`, `namespace`, `correlation`, `causation`, and projection `key`/`parent`/`with` as names.
24. Comments do not survive canonicalizing edits (PLAY0288 reprint; `droppedCommentCount`); keep durable rationale in `description` text, not `//`.
25. MCP writes: propose, review, approval, apply by the identity owner (the session that owns the MCP connection); other subagents return edit requests; proposals are connection-local, at most 16 (`cratis-screenplay-model-authoring`).
26. Operations/systems and exact numbers remain unadmitted. Sources/streams/routes bind and reference-execute as ESM v8 at 4.125.0; generated values/responses bind as v7. CLI 3.41.0 renders through v7 only, with construct-specific Stage refusals. Consult released grammar rather than inventing syntax from decisions.
27. Translate vs Automation is semantic: external facts become local facts in `Translate`; in-app event-to-event goes in `Automation`.
28. Personas drive the board: a persona must list every policy on the path, including module-level `IsAuthenticated`.
29. A sample's source check is not execution. Run selected admitted specifications through `screenplay test`/MCP; given==when clock still fires no scheduled occurrence.
30. Claims compare with `matches` (`claim "dept" matches "Finance"`); `==` is PLAY0120. Conditions with `contains`/`starts with` compile but do not bind. [probed]
31. One `every`/`all` block per projection level for V3; `$eventContext.occurred.Week` does not bind. [probed]
32. Concept rules: `min`/`max`/`length ==`, not `length 3 to 10` (PLAY0141). [probed]
33. Which compiler matters: cratis before 3.28.2 bundle Screenplay 4.60.1, which rejects ESM v6 (Automation/Translate) and reports a false PLAY0285 on cascades; cratis 3.28.2 bundles 4.66.0 and behaves like the standalone tool. Check `cratis --version` and name the tool in every verdict. [probed on both tools]

34. A `from <Event> key <property>` routes only if every such event carries that property: an event that frees or updates a row keyed by another stream's id must carry that id in its payload, or the row never changes. Whether the compiler reports a missing key property is unverified [to probe]; check by hand.
35. `description`/`documentation` are authoring metadata: board, MCP and Prologue show them; `cratis render` never does (Stage#178). A rule only in prose is unenforced in rendered code; make it a rule layer, a spec or a recorded target requirement.
36. One unadmitted construct (operations, exact numbers, refusal/redelivery) blocks whole-model binding. Routing is admitted v8, not one of those constructs; CLI render's v7 boundary is a separate refusal. Do not remove routing or authorization to render a model.
37. Personas are not in the ESM (Screenplay#254); specs cannot reference them. Write `given caller` as the roles/claims that stand for the persona.
38. A rule that depends on stored state is `reads <View>` + `require <expr> message "..."` (stated intent; PLAY0268/0271 at binding are expected in design mode). The slice `description` must mark it NOT enforced in the model today (Screenplay#129/#209) and name the target: Arc `[ProtectedDecision]` + `DecisionRead<T>` (Arc v22.39.0 and later; not available in a Stage-rendered app on Arc 22.25.0), Chronicle DCB (`concurrency` scope), or a constraint where one fits. Forbidden: caller-supplied copies of state in `require`, boolean attestation inputs (`confirmsX == true`), rules hidden in `handler`/implementation-hint prose. An unguarded materialized read is unsafe for a protected decision.

Current identity/compliance traps (v4.127.0 `identity.md`, `concepts.md`, `events.md`,
`purposes.md`, `diagnostics.md`):
- `$identity` built-ins alias `$context.identity`; declared detail reads are PLAY0268,
  while an identity block alone does not block readiness. `scoped to` is opaque,
  not a detail reference. Query sources need keyed single compatible results and
  token-only keys/gates that do not depend on details.
- `pii personal` repeats one marker (PLAY0653). Legacy markers are accepted but
  deprecated (PLAY0565); repairs preserve notes, never invent legal content.
- Event `subject` is report-only (PLAY0270), not emitted C# `[Subject]` or runtime
  lineage. Keep stream identity, data subject, encryption scope and policy subject apart.
- Purpose metadata/checks/records declare processing, not lawfulness or retention.
- PLAY0504 is an error; stream-id text is nonempty well-formed NFC (refuse, never
  normalize), Double integer ids are within ±(2^53−1); canonical UUID comparison
  ignores case. Protected concepts cannot be stream ids/parts/mapping sources (PLAY0515).
- Run `--check privilege` on elevated event-trigger paths; opaque producers are
  unknown, not safe. Arc needs `[ExecuteCommandsAsSystem]` to supply a principal.

The SKILL.md top 12: 1, 4, 5, 6, 7, 10, 12, 13, 17, 18, 20, 21 (+ mode/version notes there). Traps 39 to 44 are tool traps added at the 4.66.0 pin.
39. A handler never binds: PLAY0268 "Command '<n>' handler requires a constrained implementation attachment", with a file, a fence, `implementation` or `hint` alike. `implementation` and `hint` are accepted on a command handler, an operation execute/compensate phase and (from 4.65.0) a command property named rule, and are rejected on concept rules, built-in property rules and whole-command `require`/`validate` bodies; on a handler they are authoring intent only (no execution, lock or confirmation). A handler slice is gap-fill, not a customization of a rendered slice. [source, probed]
40. `numbers exact` parses on 4.66.0 to 4.68.0 but never binds (PLAY0268; "not admitted by any supported executable model (ESM) version yet") and is PLAY0001 on older compilers; it is absent from `grammar.md`. Never use it in a model or example meant to execute. [probed]
41. MCP roots bug (4.63.1 and earlier, including the 4.60.1 bundled by cratis before 3.28.2; not present in 4.66.0 or cratis 3.28.2, probed): a dynamic-root server answers the roots request with an `id: null` error right after `notifications/initialized`; hosts treat it as fatal. `open-workspace.path` does not help. Start with a fixed root (`screenplay mcp <folder>`, `cratis screenplay mcp` in a project with `.cratis/ai.json`) or use 4.63.2 or later (cratis 3.28.2 or later). [source, probed]
42. A symlinked model path is refused by the MCP server (macOS `/tmp` is a symlink); pass the physical path. Proposals are connection-local (at most 16); `apply` persists identities to `.screenplay/identities.json` and is not crash-atomic across files; never retry `apply` after `ApplyOutcomeUnknown`. [source]
43. `modelRevision` is canonical semantic (line positions and descriptions do not change it; a file move only if it changes logical placement or application identity) and, without `identities.json`, changes with the root folder name; it is not comparable with a render's `semanticRevision`. Source identity for verdicts is the commit plus the digest from the source-identity helper (`cratis-screenplay-modeling-lifecycle` `references/verdicts-and-modes.md` "Source identity"). [probed]
44. `cratis render` neither builds nor tests; `--name` is required for plain source; `.cratis-render/` is control state and is never staged; Stage-rendered apps are on Arc 22.25.0 (no `[ProtectedDecision]`). `cratis` file mode versus folder mode (trap 6) and a stale `cratis` on `PATH` (`which -a cratis`) both silently change what a verdict means. [source]
