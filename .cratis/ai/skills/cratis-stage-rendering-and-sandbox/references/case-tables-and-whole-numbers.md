# Case tables and whole numbers

## Contents

- Renderer and sandbox image
- One specification per case
- Whole numbers as long

## Renderer and sandbox image

The CLI's bundled renderer expands case tables into one specification per case and
renders whole numbers as `long` from ESM v8 (earlier versions keep `int`). Models above
the newest admitted ESM version receive `CLI-RENDER-004` before planning (direct Stage:
`STAGE-ESM-016`). A standalone compiler does not upgrade the bundled renderer.

`cratis run ./model --tag <stage-version>` selects a different **sandbox image**; it does not
change `cratis render`. The renderer is statically bundled and has no Stage
package/image override. A newer renderer needs a CLI release that bundles it.
Sandbox execution is not generated-application verification.

## One specification per case

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

## Whole numbers as long

The **model's ESM version**, not the Stage package version alone, selects the
C# whole-number type: v8 and later use `long`; v1–v7 retain `int` for stored-schema
compatibility. This covers properties, concepts, command inputs, events, read
models, stream ids, sentinels and literals (`0L`, `2147483648L`). Check generated
frontend types separately; this C# admission rule does not establish their mapping.
Screenplay's Double-mode whole-number range is
±(2^53−1), not the entire C# `long` range; `numbers exact` remains unadmitted.

This routed model selects ESM v8. `Quantity` wraps `long` and
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
below v8. That out-of-`int` fixture is refused with
`STAGE-ESM-031`; literals within −2147483648…2147483647 still render as `int`.
Do not remove the fixture, narrow its value or patch generated C# to pass.
Widening an already persisted event property from `int` to `long` requires a new
Chronicle event generation; changing model version is not a safe schema migration.
