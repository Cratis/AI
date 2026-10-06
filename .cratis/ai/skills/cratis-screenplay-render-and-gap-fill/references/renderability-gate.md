# Renderability gate: classifying what the probe reports

The admitted subset itself (what Stage renders, member by member) is owned by
`cratis-stage-rendering-and-sandbox` (`references/admission.md`, the code table) and
`cratis-screenplay-toolchain` (`references/renderable-subset.md`); version facts are in
`cratis-screenplay-toolchain` `references/versions.md`. This file is about **classifying** what the
probe reports and choosing what to do. Do not copy the code table here.

## Pipeline that produces the codes
1. The CLI compiles and binds the model with its **bundled** Screenplay (4.60.1 in cratis 3.27.1,
   ESM up to v5). Binding errors are `PLAY0268` (outside the admitted vertical), `PLAY0269`
   (deferred), `PLAY0270` (report-only information), `PLAY0271` (legacy semantics) and `PLAY0273`
   (a specification shape).
2. Execution planning builds the plan and can emit `PLAN-*` diagnostics before Stage runs.
3. Stage plans the target and admits or rejects each member: `STAGE-ESM-0xx`; profile and path
   problems `STAGE-CRATIS-0xx`. For an ESM v4 model with evolved events the CLI adds
   `CLI-RENDER-003` after Stage's own `STAGE-ESM-016` version refusal, as a supplementary
   generation diagnostic, not as a pre-check.
4. Any error anywhere publishes nothing: the run ends with exit 5 and the diagnostics.

The standalone `screenplay` tool can report V3 ready where the bundled binder refuses (newer
ESM). Only the probe answers renderability. `PLAY0270` entries are information, not blockers.

## Classification

| Class | Meaning | Typical examples (each verified in `admission.md`) | Action |
| --- | --- | --- | --- |
| **Model fix (in mode)** | the model is in, or the user chose, renderable mode and breaks its own subset in a way that has a renderable equivalent with the same meaning | a `produces` whose `for` is not the command identifier; one `StateChange` slice with two commands (`STAGE-ESM-004`); two projections for one read model (`-007`); a policy without `authenticated` (`-015`) | edit request to the modeler session with address, change and rationale |
| **Capability gap** | the intended meaning needs a construct Stage does not render yet | list, observable and filtered queries (`PLAY0268` "must declare one caller-supplied 'by'", `-010`); Automation and Translate slices (`PLAY0268` "not admitted by ESM v1", `-001`, Stage#79); reactions, clocks, captures and triggers (v6, `-016`); event generations (`CLI-RENDER-003`); conditional `produces when` (`-006`); `reads` (`PLAY0271`); code validation (`-005`); opaque policies (`-015`); compliance attributes (`PLAY0268` "require portable data-subject semantics"); a command `handler` (`PLAY0268`) | keep the model; ledger entry; options a to c in `SKILL.md`; link the Stage issue |
| **Tool skew** | the bundled compiler disagrees with documented semantics | the false `PLAY0285` on reaction cascades (cli#242); codes the standalone compiler does not raise | record in the session state and the ledger; never "fix" a correct model |
| **Environment** | not the model | restore failures, missing SDK, a destination that is not writable | fix the environment or report blocked |

## Triage rules
- A capability gap never becomes a model fix by deleting meaning. Turning a list screen into a
  keyed lookup, dropping `@pii`, removing authorization or a rule, or splitting a conditional
  outcome into separate commands is a **modeling decision** for the user and the modeler, made
  for business reasons, not to please the renderer.
- A refusal never licenses dropping a specification, an event generation or a protection.
- Group codes by construct and count, report the first few with their `file(line,col)` location,
  and keep the full JSON in the probe folder. Do not paste the list.
- One error blocks the whole application. Say how many slices are affected, and which slices
  would render if the blockers were removed (from the locations), marked as an estimate.
- Admission can pass and a Debug test still fail. Admission is never a passing test; see
  `cratis-stage-rendering-and-sandbox` `references/render-example.md`.

## Stage issues to cite in ledger entries
Read at the time of writing (all open): portable query semantics Stage#58 (list, observable and
filtered queries); Automation and Translate slices Stage#79; mapping expressions and projection
blocks Stage#117; modeled authentication Stage#120; event generation v4 Stage#165; per-persona
screens Stage#194; compliance attributes Stage#197. Check that an issue is still open before citing
it, and cite only numbers you have just read. A closed issue is a trigger to probe again.

## Reference outcomes
- The complete marina model of `cratis-stage-rendering-and-sandbox` `references/render-example.md`:
  admission ok, 30 artifacts, Debug build ok, 7 tests passed (cratis 3.27.1).
- The model in `worked-example.md`: admission refused with 2 blocking `PLAY0268` diagnostics, nothing published.
