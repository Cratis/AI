# Example: a model inside the Stage 4.24 renderable subset

## Contents

- What was run
- What came out

A complete marina-berth model that `cratis render` 3.28.2 and 3.28.3 accept, followed by what the
render produced and how each claim was checked. Use it as a shape to stay inside when a
model must be renderable; it is not a template for richer slices (see `admission.md`).

```screenplay
// cratis-stage-rendering-and-sandbox: a complete model inside the Stage 4.24 renderable subset.
// Two commands with one event each, one projection with a removal, one keyed snapshot query,
// declarative authorization and three reference specifications. Compiles with warnings as errors
// and renders with `cratis render`; no code attachments, no ESM v4+ constructs.

domain Harbour.Marina

concept BerthId : Uuid                     // event source id of one berth stream
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

      specification ShowingAReservedBerth
        given caller
          authenticated
          role "HarbourMaster"
        when ReserveBerth
          berthId  = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          boatName = "Sea Otter"
        then BerthReserved
          for "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          boatName = "Sea Otter"
        then query BerthStatusById
          arguments
            berthId = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
          result
            boatName = "Sea Otter"

    slice StateChange ReleaseBerth
      command ReleaseBerth
        berthId BerthId identifier
        authorize IsHarbourMaster
        produces BerthReleased
          for berthId
      event BerthReleased
      specification ReleasingABerth
        given caller
          authenticated
          role "HarbourMaster"
        when ReleaseBerth
          berthId = "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"
        then BerthReleased
          for "6f1c2a8e-0b1d-4d55-9a3e-2f6a7c1d0e11"

    slice StateView BerthStatus
      description "Who holds a berth now"
      readmodel BerthStatus
        berthId  BerthId
        boatName BoatName
      query BerthStatusById => BerthStatus optional
        by berthId BerthId
      projection BerthStatusProjection => BerthStatus
        from BerthReserved
          boatName = boatName
        remove with BerthReleased
```

Why it is shaped this way:

- Each command has one unconditional `produces`, with a typed `for` on the identifier.
- The policy requires authentication as well as the role; a role alone is `STAGE-ESM-015`.
- The projection has a `from` and a `remove with`, so Stage renders it as a scoped
  projection keyed by the event source. The identifier is never mapped: the key
  establishes it, and mapping it is `STAGE-ESM-017`.
- The query is the admitted shape: `=> X optional` with one `by` equal to the read-model
  identifier. It has no `authorize`, so it renders as `[AllowAnonymous]`.
- The specifications that assert a query sit in the **command** slice: a `then query`
  needs the `when` command of its own slice and the `then` event as well.
- No `handler`, no code attachments, no reactions, no ESM v4 or newer constructs.

## What was run

All with cratis 3.28.2 (re-run end to end from 3.27.1: same counts; admission and publication re-run on 3.28.3 with Stage 4.24.2: the same 30 artifacts) on a folder holding only `berths.play`:

| Step | Command | Result |
| --- | --- | --- |
| Compile | `screenplay <folder> --warnaserror` (4.66.0) and `cratis screenplay validate <folder> --warnings-as-errors` | 0 errors, 0 warnings |
| Admission and publication | `cratis render <folder> --name Marina --destination out -o json` | exit 0, 30 artifacts written, `recovered: false` |
| Re-render | the same command | `written: 0`, `unchanged: 30` |
| Local edit | append a line to `out/Program.cs`, render again | exit 5: `Managed artifact 'Program.cs' was modified by the user; pass --force to replace it.` |
| Forced | the same with `--force` | `written: 1`, `unchanged: 29` |
| Missing name | render without `--name` | exit 5: `A valid --name is required and must be a C# identifier` |
| Debug build | `dotnet build out/Marina.csproj -c Debug` | succeeded, 0 warnings, 0 errors |
| Debug tests | `dotnet test out/Marina.csproj -c Debug` | 7 passed, 0 failed |

Runtime (`docker compose up`, `/healthz`) and the frontend build were **not run**.

**Admission is not a passing test.** An earlier draft of the query specification also
asserted `berthId` in the `result`. It was admitted and built, and its rendered Debug
test failed (`should_return_the_expected_read_model`): the scoped projection does not set
the identifier property in that scenario. Dropping the identifier from the `result` made
all 7 tests pass. That removes an assertion about the key, so it is an accepted
trade-off only when the model's owner agrees; otherwise record it as a capability gap.

## What came out

```text
.cratis-render.json                      ownership manifest: semanticRevision, identity, path + SHA-256
Marina.csproj, Marina.slnx               project named from --name
Program.cs, GeneratedPolicyRegistration.cs, GeneratedPolicies/Policies.cs
appsettings.json, docker-compose.yml, Directory.Build.props/.targets, Directory.Packages.props
Common/BerthId.cs, Common/BoatName.cs    concepts
Berths/Reservations/ReserveBerth/ReserveBerth.cs                    [Command] record, Handle(), [EventType] event, validator
Berths/Reservations/ReleaseBerth/ReleaseBerth.cs                    the second command and event
Berths/Reservations/*/when_*.cs                                     Debug-only specification classes
Berths/Reservations/BerthStatus/BerthStatus.cs                      [ReadModel] record, keyed query, projection
scene.json, package.json, tsconfig.json, src/bindings.ts, .gitignore, .frontend/*   React/Vite scaffold
```

The namespace follows the folders under the application name
(`Marina.Berths.Reservations.ReserveBerth`), and a specification class lives in a
namespace of its own name, so it is `...ReserveBerth.when_reserving_aberth.when_reserving_aberth`.
A command carries `[Authorize(Policy = "StagePolicy_sem1_...")]` with a generated policy
that checks `IsAuthenticated` and `IsInRole("HarbourMaster")`. After a successful
publication the destination holds the manifest and no `.cratis-render/` control directory.
