<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Availability in Arc for Elixir

Arc for Elixir ships availability (v1.3.0): the same model as Arc for .NET and Screenplay, in the same words.
Verify names against the package's `Documentation/availability.md`.

It is one gate and runs **first**, before binding, `Cratis.Arc.Filter`, authorization and validation.

| Decision | Result |
| --- | --- |
| Available | The request continues to authorization and validation. |
| Not available, or unknown | Not authorized, reason `NotAvailable`, HTTP `403`. |
| Suspended | Not authorized, reason `Suspended`, HTTP `403`. |
| The decision could not be made | Retryable error (`isRetryable` true), HTTP `503`; never a denial. |

## Configure and declare

```elixir
config :my_app, MyApp.Arc,
  availability: [
    definition: MyApp.Availability,
    audience_source: MyApp.AudienceSource,
    suspension_source: MyApp.SuspensionSource,
    pubsub: MyApp.PubSub
  ]
```

```elixir
defmodule MyApp.Availability do
  use Cratis.Arc.Availability.Definition

  audience "Plus", "Customers on the Plus package"
  block "Paid", "Sold with Plus", for: ["Plus", "Admin"]
  scope "MyApp.Fleet", with: "Paid"
  value "vessel", MyApp.VesselValue
end

defmodule MyApp.Fleet.Vessels.DockVessel do
  use Cratis.Arc.Command
  available for: ["Plus", "Admin"], not: "Preview", with: "Reported"
  available when: Cratis.Arc.Availability.Condition.equal("vessel.package", "Plus")
end
```

- `for:` audience(s), one is enough; `not:` none may be held; `with:` a named block; `when:` a condition
  (`Cratis.Arc.Availability.Condition` data shared with other languages, or a module implementing the behaviour).
- On a read model `available` gates every query; `@query available: [...]` gates one query.
- Module, feature and slice come from `Cratis.Arc.Descriptor.slice_location/2`.
- Conditions read `tenant`, `identity.user`, `arguments.<name>` (camelCase wire name) and `<name>.<path>` of a
  provided value; tenant and identity always come from the server.
- Three values: available, unavailable, unknown. Only available opens a gate; an absent value is unknown for every
  operator. `Cratis.Arc.Availability.Engine` passes the shared conformance cases.

## Sources: audiences granted and withdrawn, parts suspended and resumed

- `Cratis.Arc.Availability.AudienceSource`: `grants(subject)` returns the audience names held. Undeclared audiences never match.
- `Cratis.Arc.Availability.SuspensionSource`: `suspended/0` returns paths (`"Fleet"`, `"Fleet/Vessels"`,
  `"Fleet/Vessels/Dock"`, or a part's full name); suspension is decided before any gate.
- `Cratis.Arc.Availability.Memory` serves specifications and samples (`grant/2`, `withdraw/2`, `suspend/1`, `resume/1`).
- Call `Cratis.Arc.Availability.changed/1` when a source changes; open sessions decide again, on every node with `:pubsub`.

## Client

- `/.cratis/availability` is an observable query listing what is unavailable to the caller (name, module, feature,
  slice, reason); `?part=<name>&arguments=<json>` asks about one part. A decision that cannot be made is a retryable error.
- Generated proxies carry `static readonly part` (part identity).
- LiveView: `<Cratis.Arc.LiveView.Availability.available socket={@socket} version={@arc_availability} command={...}>`
  hides a part (`Cratis.Arc.LiveView.available?/3`). Hiding is presentation; the server still refuses.
- `Cratis.Arc.Availability.Manifest.build/1`, `to_json/1`, `decode/1`, `decide/3` use the shared
  `cratis-availability-manifest` (version 1).

## Rules

- Model availability in Screenplay (`cratis-screenplay-availability`); do not invent a second gating mechanism.
- Keep the vocabulary: audiences are granted and withdrawn; parts are suspended and resumed.
- Unknown is closed; failure to decide is a retryable error, never a denial.
- Compare the C# side in `cratis-arc-hosting` (`references/availability.md`).
