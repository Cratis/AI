# Gap-fill hand-off to `slice-implementer`

For scope the renderer rejects (case C in `SKILL.md`) and for hand-written scope next to a
generated base (case B). The render phase reports the capability boundary; the implementer
authors the code with the `.play` slice and its specifications as the contract. Contract
reconciliation, specification mapping, delta delivery and the final status are owned by
`cratis-application-slice-conformance`; this file only says what the brief carries and what
comes back.

## One scope per brief
One ledger entry (`drift-and-ledger.md`), one scope, one implementer. The brief is a set of
paths and addresses, not pasted contents:
- model root, source identity, the qualified slice addresses (`Module/Feature/Slice`) in scope,
  their specifications and the referenced contract locations;
- the blocking codes from the probe and the ledger entry id;
- target project, owned paths, and the repository's conventions (Arc and Chronicle hand-written
  slices; `rules/vertical-slices.md`);
- the skill per slice kind: State Change `cratis-screenplay-command-surface`; State View
  `cratis-screenplay-projections` and `cratis-screenplay-read-surface`; Automation and Translate
  `cratis-screenplay-automations-and-translations` and `cratis-screenplay-captures-and-reactions`;
  the code skills `cratis-arc-command`, `cratis-chronicle-read-model`, `cratis-chronicle-reactor`;
- rules that live in prose today, each with its intended realization and a test (see "Rules the
  model states only in prose");
- known unsupported semantics, open questions and the checks required before reporting done;
- the standing instruction, verbatim in spirit: *The `.play` slice and its specifications are
  the specification. Do not invent fields, rules or defaults. Each specification becomes a test
  with the same name; never weaken, skip or delete one to pass. Do not edit managed files.
  Return a field inventory (command, event and read-model properties mapped to code locations)
  and list anything you added that the model does not state (expected: none). Realization notes
  in the slice description bind adapters and fallback code. The repository's pattern wins over a
  generic template; report the mismatch. Stop on a contradiction and return an edit request.*

Before coding, the implementer reads each scoped slice completely: descriptions,
specifications, concepts, inherited authorization, referenced events and views, and resolves
ambiguous addresses; contracts are never inferred from names.

## What comes back
- Status `done | partial | blocked` from `cratis-application-slice-conformance`.
- The specification mapping (specification, test, result), the field inventory, divergences
  with who approved them, and the check results, recorded in the ledger entry.
- Edit requests for the modeler session: address, change, rationale. Walkthrough-derived cases
  belong in accepted `.play` specifications first, never as a second behavioural contract in
  code-only tests. Integration tests may check wiring and persistence without inventing rules.
- The gate: the repository's Tier 1 checks, plus integration evidence for the behaviour claimed;
  unavailable checks are `not run: <reason>`. The delivered code then goes through code review.

## Rules the model states only in prose
A rule that exists only in a description, or a state-dependent rule the model marks as not
enforced, is unenforced in generated scope. List it in the ledger as a target requirement. In
hand-written code it needs an atomic enforcement point: a protected read or a concurrency scope
(in a Stage-rendered application Arc is 22.25.0, which has no `[ProtectedDecision]`; a
hand-written application on a newer Arc may use it), or a Chronicle constraint. A stale view or
a caller-supplied status is not enforcement.

## Automation and Translate scope
Stage 4.24 renders no Automation or Translate slice, so the whole automation is gap-fill: the
reactor and its adapter, written against the slice and its specifications. Where they are
registered depends on the case. Case B (a generated base exists, and the user authorized the
gap-fill): the registration goes through the seams in `Customizations/Program.cs`, which does
not bind a modeled reaction or capture. Case C (no generated application): there is no generated
`Program.cs` or partial hook, so the registration follows the hand-written application's own
composition conventions (`rules/vertical-slices.md`, `cratis-chronicle-reactor`).
A reaction invokes a command with no caller (Screenplay has no caller syntax today), so the
code needs a trusted path (`[ExecuteCommandsAsSystem]`, Arc 20.56.0 and later, in a rendered
application's Arc 22.25.0 too); never invent `runs as`.

## Re-delivery
The work list is the full in-scope contract delta since the ledger's last verified source
identity (specifications, rules, mappings, realization notes), then the whole contract is
reconciled again and the field inventory redone. The specification delta is one ledger field.
When the scope later renders (a revisit trigger fires), plan the migration to managed output
with the user: the hand-written files collide with planned paths and must move first.
