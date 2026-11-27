<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Product sources

| Fact | Value | Source |
| --- | --- | --- |
| Packages | `cratis_arc` (core, Plug, Phoenix, LiveView), `cratis_arc_mongodb` | `Source/arc/mix.exs`, `Source/arc_mongodb/mix.exs` |
| Elixir requirement | `~> 1.18` | `mix.exs` |
| Chronicle dependency | `cratis_chronicle ~> 4.0` (modules are `Cratis.Chronicle.*`) | `Source/arc/mix.exs` |
| MongoDB driver | `mongodb_driver ~> 1.6` | `Source/arc_mongodb/mix.exs` |
| Release | Source preview. Every release is published to Hex automatically: depend on `{:cratis_arc, "~> 1.4"}` from Hex, never a path or git reference, and check hex.pm for the current version | repository, `gh release list` |
| Module namespace | Everything is `Cratis.Arc.*` (`use Cratis.Arc.Command, id: "..."`); sources are under `Source/arc/lib/cratis/arc/` | repository |
| Documented gaps | `Documentation/limits-and-gaps.md` | repository |
| Contract | The Arc HTTP contract | Cratis/Arc `Documentation/http-contract.md` |
