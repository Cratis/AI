# Worked example: a refused render, the classification and the report

A marina model with one renderable command and one list view. The model compiles; `cratis render`
refuses it, so nothing is published. The example shows how to classify, decide and report.

## The model

```screenplay
// cratis-screenplay-render-and-gap-fill: complete model for the refused-render example.
// Compiles with warnings as errors; `cratis render` 3.27.1 refuses the list query.
domain Harbour.Marina

concept BerthId : Uuid
concept BoatName : String
  validate
    not empty  message "A boat name is required"

policy IsHarbourMaster
  require authenticated and role "HarbourMaster"

module Berths
  description "Which boats hold which berths"
  feature Reservations
    slice StateChange ReserveBerth
      description "A boat reserves one berth"
      command ReserveBerth
        berthId  BerthId identifier
        boatName BoatName
        authorize IsHarbourMaster
        produces BerthReserved
          for berthId
          boatName = boatName
      event BerthReserved
        boatName BoatName
      specification ReservingABerth
        given caller
          authenticated
          role "HarbourMaster"
        when ReserveBerth
          berthId  = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          boatName = "Sea Otter"
        then BerthReserved
          for "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          boatName = "Sea Otter"

    slice StateView BerthRegister
      description "All berths with their current boat"
      readmodel BerthEntry
        berthId  BerthId
        boatName BoatName
      query AllBerths => BerthEntry[]
      projection BerthEntryProjection => BerthEntry
        from BerthReserved
          berthId  = $eventSourceId
          boatName = boatName
```

## The probe

Source identity recorded first (`<commit>+<digest>`), tools named: `screenplay 4.66.0`, `cratis 3.27.1`.
V1 passed on both. Then:

```text
$ cratis render <model-root> --name Marina --destination .ai-work/screenplay/marina/render-probe/Marina -o json
exit 5, nothing published
PLAY0268 hire.play(38,7)  Read model 'BerthEntry' must have one unambiguous keyed query to identify
                          instances in the first ESM v1 vertical.
PLAY0268 hire.play(41,7)  Query 'AllBerths' must declare one caller-supplied 'by' argument in the
                          first ESM v1 vertical.
(+ four PLAY0270 information entries: authoring metadata, not blockers)
```

## Classification

| Diagnostic | Class | Why |
| --- | --- | --- |
| `PLAY0268` `AllBerths` | capability gap | the business question is "show all berths"; Stage renders only a keyed optional lookup (Stage#58) |
| `PLAY0268` `BerthEntry` keyed query | capability gap (same cause) | it follows from the missing keyed query |

Both blockers sit in one slice, `Berths/Reservations/BerthRegister`; `ReserveBerth` would pass on
its own (an estimate: the rest of the model was not probed alone, and a partial render does
not exist). The tempting "model fix" is a keyed `BerthById` lookup in place of the list. That
changes what the harbour master can see, so it is a **modeling decision for the user**, never a
renderer workaround. Here the user keeps the list.

## Decision and ledger entry

Case A, then case C for the list: the user keeps the full model, `ReserveBerth` and the view are
delivered by hand, and the model stays the contract.

```text
F1  scope: Berths/Reservations/BerthRegister (spec: none yet) ; Berths/Reservations/ReserveBerth (ReservingABerth)
    blocking codes: PLAY0268 x2 (list query, keyed query)
    class: capability gap          decision: implementer (user, <date>)
    fallback location: src/Marina.Application/Berths/    spec mapping: ReservingABerth -> to be written
    revisit trigger: Stage#58 (portable query semantics)  last verified: <source identity>
```

Gap noted for the modeler: `BerthRegister` has no specification, so its hand-written delivery
has no oracle for the list; the edit request asks `cratis-screenplay-scenario-coverage` for one
(`given` the reservation event, `then query AllBerths` with the expected rows, subject to
what the reference execution route supports).

## The report

```text
Mode: renderable (user chose)   Source: <commit>+<digest>   tools: screenplay 4.66.0, cratis 3.27.1
V1 authorable:  pass (1 file, screenplay 4.66.0; cratis validate also pass)
V2 diagnostics: not run: no MCP in this session (the bundled binder's PLAY0268 came from the render probe)
V3 binding:     blocked: PLAY0268 x2 (cratis 3.27.1 bundled binder)
V4 specs:       not run: no reference execution route in this toolchain (1 specification written, none run)
V5 admission:   refused, 2 blocking diagnostics (list query), nothing published
V5 publication: not run: admission refused
V5 build:       not run: nothing published
V5 tests:       not run: nothing published
UI omissions:   not applicable (no render)
Hand-off:       F1 to slice-implementer (brief: paths and addresses; contract: the .play slice and its
                specifications; conformance: cratis-application-slice-conformance)
Edit request:   BerthRegister needs a specification for the list (address, expected rows)
```

When the list query later renders, probe again with the same inputs. If it does, plan the
migration from hand-written files to managed output with the user before re-rendering; a hand
file on a planned path makes publication refuse.
