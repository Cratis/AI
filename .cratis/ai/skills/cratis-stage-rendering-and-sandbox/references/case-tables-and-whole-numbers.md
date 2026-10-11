<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Case tables and whole numbers: check the Stage version

## Contents

- CLI default versus Stage release
- One specification per case (Stage 4.59.0+)
- Whole numbers as long (Stage 4.61.0+)
- Released source evidence

## CLI default versus Stage release

CLI 3.50.0 bundles Screenplay 4.131.0 and Stage 4.67.0. Its default renderer
applies case-table support introduced in Stage 4.59.0 and the whole-number rule
introduced in 4.61.0: v8+ whole numbers use `long`, earlier versions keep `int`.
CLI and Stage admit through v10 to construct checks; newer versions receive
CLI-RENDER-004 before planning (direct Stage: STAGE-ESM-016).
Previous CLI 3.46.1 bundled Screenplay 4.130.0/Stage 4.52.0, applied neither rule,
and refused above v7. A standalone compiler does not upgrade the bundled renderer.

`cratis run ./model --tag 4.63.2` selects a newer **sandbox image**; it does not
change `cratis render`. The renderer is statically bundled and has no Stage
package/image override. A newer renderer needs a CLI release that pins it.
Sandbox execution is not generated-application verification.

## One specification per case (Stage 4.59.0+)

Case tables expand before rendering. The effective specification names are
`<Specification>_<Case>`; Stage emits one Debug specification class per case,
then applies its usual `when_<snake>` naming. This complete example yields
`Registering_Small` and `Registering_Large`, rendered as
`when_registering_small` and `when_registering_large` (one file/class each):

```screenplay
concept ProjectId : String
concept ProjectName : String
module Projects
  feature Registration
    slice StateChange Register
      command RegisterProject
        projectId ProjectId identifier
        name ProjectName
        produces ProjectRegistered
          for projectId
          name = name
      event ProjectRegistered
        name ProjectName
      specification Registering
        parameter name ProjectName
        case Small name = "small"
        case Large name = "large"
        when RegisterProject
          projectId = "project-1"
          name = case.name
        then ProjectRegistered
          name = case.name
```

Generated path comparisons are case-insensitive. Adding `case large` alongside
`case Large` can pass source validation but normalizes to the same generated
path: Stage refuses the whole plan with `STAGE-CRATIS-004`, never overwrites one
case with another. Choose distinct names in the model; do not edit generated files.

A failing case in SpecRunner or Host results names its authored specification,
case and effective fixtures: `Case '<Case>' of '<Specification>': … Effective
fixtures: …`. Read the failure details and each case outcome; SpecRunner exit 0
alone is not a pass. Map generated Debug test classes back to effective cases,
not just to the authored table or a total count.

## Whole numbers as long (Stage 4.61.0+)

The **model's ESM version**, not the Stage package version alone, selects the
C# whole-number type: v8 and later use `long`; v1–v7 retain `int` for stored-schema
compatibility. This covers properties, concepts, command inputs, events, read
models, stream ids, sentinels and literals (`0L`, `2147483648L`). Check generated
frontend types separately; this C# admission rule does not establish their mapping.
Screenplay's Double-mode whole-number range is
±(2^53−1), not the entire C# `long` range; `numbers exact` remains unadmitted.

This routed model selects ESM v8. On Stage 4.61.0+, `Quantity` wraps `long` and
the fixture renders as `2147483648L`:

```screenplay
concept StockId : String
concept Quantity : Int
eventsource Stock
  identifier StockId
  stream Measurements
module Inventory
  feature Stock
    slice StateChange Record
      command RecordStock
        stockId StockId identifier
        quantity Quantity
        stream Stock.Measurements
        produces StockRecorded
          for stockId
          quantity = quantity
      event StockRecorded
        quantity Quantity
      specification RecordingLargeQuantity
        when RecordStock
          stockId = "stock-1"
          quantity = 2147483648
        then StockRecorded
          quantity = 2147483648
```

Without the `eventsource` declaration and command `stream` clause, the model is
below v8. On Stage 4.61.0+, that out-of-`int` fixture is refused with
`STAGE-ESM-031`; literals within −2147483648…2147483647 still render as `int`.
Do not remove the fixture, narrow its value or patch generated C# to pass.
Widening an already persisted event property from `int` to `long` requires a new
Chronicle event generation; changing model version is not a safe schema migration.

## Released source evidence

- Stage `v4.59.0`: `Source/Rendering.Cratis/for_CratisArtifactRenderPlanner/given/a_specification_case_table.cs`,
  `when_executing_generated_case_table_specifications.cs`, `when_refusing_colliding_case_names.cs`,
  `CratisArtifactRenderPlanner.cs`; `Source/Specifications/SemanticSpecificationExecutor.cs`
  and `Source/SpecRunner/for_Program/when_running_semantic_case_tables.cs`.
- Stage `v4.61.0`: `Source/Rendering.Cratis/Semantics/SemanticTypeSystem.cs`,
  `SemanticCratisAdmission.WholeNumbers.cs` and
  `Source/Rendering.Cratis/Semantics/for_SemanticCratisAdmission/when_admitting_whole_number_literals/with_a_pre_v8_model.cs`.
- CLI `v3.50.0` (previous bundle `v3.46.1`): `Directory.Packages.props`,
  `Source/Cli/Commands/Render/{RenderSettings,CratisRenderTarget,RenderedSemanticVersions}.cs`,
  `Source/Cli/Commands/Run/{RunSettings,StageContainer}.cs`.
