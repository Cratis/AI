# Drift, publication refusals and the fallback ledger

## 1. Drift: the model changed, the output was not re-rendered
The ownership manifest `.cratis-render.json` at the destination records `semanticRevision`
(`rev1:<sha256>`), the target, the renderer, the application name and a hash per managed file.

Facts verified with `cratis render` 3.27.1 on one model: the same files rendered under the names
`Marina` and `Harbour` gave different `semanticRevision` values, so **the application name is part
of the revision**. The MCP workspace names the application after the model root folder (without
`.screenplay/identities.json`), so its `modelRevision` is not comparable with a render's manifest
revision by assumption. It also moves with the root folder name and file locations.

Compare in this order:
1. **Source identity** (`cratis-screenplay-modeling-lifecycle` `references/verdicts-and-modes.md`):
   compute it for the current model and compare it with the identity recorded when the output was
   rendered. Equal: the same model bytes, whatever git says. Different: the output is behind the model.
2. **Manifest revision:** render the current model with the **same** `--name` and inputs into a
   fresh probe folder (`.../render-probe/<App>-drift`) and compare its manifest `semanticRevision`
   with the published one. Equal: no semantic change since publication. Different: re-render and review the receipt.
3. Equal revisions prove neither customization conformance nor faithful UI.

Use the same toolchain as the render; revisions from another Screenplay version are not
comparable by assumption. A dirty git flag or commit is context, never a revision.

## 2. Publication refusals (code changed under the model)

| Refusal | Meaning | Do |
| --- | --- | --- |
| managed file "modified by the user" | someone edited generated output | the model is authoritative. Diff the file against a fresh probe render; if the edit expresses wanted behaviour, move it into the model (edit request) or a `Customizations/` seam; then ask for approval to re-render with `--force` for that destination |
| unmanaged existing file on a planned path | a hand-written file collides with a planned artifact | move or rename the hand file (ask); never delete it unasked |
| modified stale managed file | a file the model no longer plans was edited | as a modified managed file; it will not be removed |
| manifest identity change (target, renderer, application name) | different render inputs | restore the original inputs, or treat it as an explicit migration the user approves |

`--force` replaces modified **active** managed files only; it never overwrites unmanaged files or
removes modified stale ones. It needs approval naming the effect and destination (a direct user
request already naming them counts); ask again only if the target or consequence expands.
Re-render checklist: `cratis-stage-rendering-and-sandbox` `references/rendered-application.md`.

## 3. Build breaks in `Customizations/` after a re-render
A generated contract changed. Read the error line and the generated type it names, fix the
adapter, rebuild. Never edit the generated file.

## 4. Fallback ledger
One file per model: `.ai-work/screenplay/<model-slug>/fallback-ledger.md`, untracked. A durable
record belongs in repository documentation or an issue, not in the ledger file. One entry per
non-renderable scope:

| Field | Content |
| --- | --- |
| id | `F<n>` |
| scope | slice addresses (`Module/Feature/Slice`) and their specifications |
| blocking codes | from the probe, grouped (`PLAY0268` list query x2, `STAGE-ESM-016`) |
| class | capability gap / tool skew / model fix pending |
| decision | stay design / renderable-mode change (user, date) / implementer |
| fallback location | project and folder of the hand-written code |
| spec mapping | `.play` specification to test name, one line each; missing tests listed |
| field inventory | `n/n` command, event and read-model properties mapped; extras: none, or listed with reason |
| hints used | realization notes from slice descriptions applied, one line each |
| spec delta | at re-delivery: specifications added, changed or removed since `last verified`, each with test status |
| divergences | where the code deliberately differs from the model, with reason and approver |
| revisit trigger | issue and condition (for example "Stage#58 ships list queries") |
| last verified | source identity and date the mapping was checked |

When a revisit trigger fires, probe again; if the scope now renders, plan the migration from
hand-written code to managed output with the user.
