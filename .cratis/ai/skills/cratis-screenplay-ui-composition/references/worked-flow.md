# Worked flow: marina berth bookings

Complete document, design-mode (the list query `ListBerths` keeps it out of the executable
subset; see `cratis-screenplay-slice-design`). Used by `SKILL.md`, *Compose in this order*.

```screenplay
concept BerthId : Uuid
concept BoatName : String

module Marina
  feature BerthBookings
    slice StateChange BookBerth
      command BookBerth
        berthId BerthId identifier
        boatName BoatName
        produces event BerthBooked
          boatName BoatName = boatName
      screen BookBerthScreen
        title "Book a berth"
        data BerthListView[] via query ListBerths
        action BookBerth
          navigate to BerthListScreen
    slice StateView BerthList
      readmodel BerthListView
        berthId BerthId
        boatName BoatName
      projection BerthListProjection => BerthListView
        from BerthBooked
          berthId = $eventSourceId
          boatName = boatName
      query ListBerths => BerthListView[]
      screen BerthListScreen
        data BerthListView[] via query ListBerths
        action BookBerth
          navigate to BookBerthScreen

  form BookBerthForm for BookBerth
    field berthId label "Berth"
    field boatName label "Boat name"
    on submit navigate to BerthListScreen
```

## Field trace

| Where | Field | Origin | Status |
| --- | --- | --- | --- |
| `BookBerthForm` | `berthId` | `BookBerth.berthId`, typed by the user | traced |
| `BookBerthForm` | `boatName` | `BookBerth.boatName` | traced |
| `BerthBooked` | `boatName` | `BookBerth.boatName` (declared payload) | traced |
| `BerthListView` | `boatName` | `BerthBooked.boatName` | traced |
| `BerthListView` | `berthId` | event source id of `BerthBooked`, which is `BookBerth.berthId` | traced |

Command to event to read model to screen: each hop is declared. A projection cannot read a
payload field the event never declares, so the event payload line matters.

## Notes

- `identifier` marks which property names the event source. It neither generates the value nor
  fills it. Here the user supplies the berth. Other sources are a prefill (`populate via query`
  or `populate from item` when the user chose a berth on the previous screen) or a modeled
  selection. `generated identifier` is syntax-only at v4.66.0 (binding reports `PLAY0268` until
  ESM v8).
- The form is found through `action BookBerth`; neither screen names it.
- Compiled with `screenplay` 4.66.0 `--warnaserror` and `cratis screenplay validate
  --warnings-as-errors` 3.28.2.
