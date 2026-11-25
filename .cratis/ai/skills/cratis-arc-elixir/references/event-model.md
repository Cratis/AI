<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Event model explorer

Arc serves the same explorer as the C# Arc at `/.cratis/event-model/`: the slices of each feature
(and sub-feature) with their commands, events, read models, queries and reactions, and the Screenplay
source. It is drawn from the code, so slice and event names are what readers see.

## Switch it on

```elixir
# mix.exs
compilers: Mix.compilers() ++ [:arc_event_model],
arc: [application: MyApp.Arc, event_model_strict: true]
```

- The compiler writes `priv/cratis/event_model/` while the app compiles (`catalog.json`, a
  `*.model.json` and a `*.screenplay` per document: the application, each module, each feature at every
  depth). It is part of every release; nothing is analysed at run time. Commit it.
- The routes are served by `Cratis.Arc.Plug`: `/.cratis/event-model/`, `hierarchy`,
  `documents/{project}/{document}/model|source` and `assets/*`. **Mount `Cratis.Arc.Plug` before anything
  that only accepts HTML** (a Phoenix endpoint's `plug :accepts, ["html"]` answers 406 to the
  explorer's JSON requests).
- `event_model:` on the Arc application is `:auto` (default: development only), `true` or `false`;
  `introspection` decides who may read it (`:authenticated` default, `:anonymous`, `false`);
  `event_model_apps: [:other_app]` adds other OTP apps' embedded models.
- `/.cratis/structure` lists the same modules, features and slices (nested) with their commands and
  read models, for tools such as Lens. `display_names:` on the application chooses how an id is shown.

## How slices are found

- A slice is the module namespace after `segments_to_skip` as `[module, feature..., slice]`: the first
  segment is the module, the last the slice, **everything between is a feature path**, so
  `Prism.Access.ApiCredentials.Secrets.RotatingSecrets.RotateSecret` with `segments_to_skip: 1` is the
  slice `RotatingSecrets` of the sub-feature `Secrets` of the feature `ApiCredentials` of the module
  `Access`. The board nests sub-features as `subFeatures`, the Screenplay source nests `feature` inside
  `feature`, and each depth has its own document. Fewer than three segments fill the deepest parts first.
- A slice with a command is a state change; with a read model, reducer or projection a state view; with
  only a reactor an automation. **Keep a view's query module inside its slice folder**
  (`Viewing.Listing.Queries`): a read model module sitting in the parent namespace is grouped with
  the parent, not with its slice.
- **The events of a command are the event types its compiled code builds** (read from the debug info of
  the module, helpers included). A command that gets its events from another module shows only what it
  builds itself. A reactor's `@handles` is what it reacts to and its code is what it emits.
- A view consumes the events its reducer or projection handles. Another read model over the same
  model consumes the same events. A model read some other way (the event log) declares them:
  `use Cratis.Arc.ReadModel, model: ..., consumes: MyApp.Events.all()`.
- **Names are ids.** Commands, event types and reactors are shown by their `id:` in PascalCase;
  `display_names:` chooses `:pascal_case` (default), `:kebab_case`, `:as_declared` or a function.

## It is validated

The compiler reports what is incomplete (warnings; errors with `event_model_strict: true`):

| Problem | Fix |
| --- | --- |
| a state change without a command, or whose command appends no events | the command must build its event types in its own module |
| a view without a read model, or that consumes no events | add a reducer or projection, or `consumes:` |
| an automation that reacts to no event, or records none | have the reactor return the event that says what it did (`SecretRetiredInOry`), not nothing |
| a consumed event no slice produces | the event needs a command appending it |
| a fact used before it is produced | move the slice into a sub-feature after the ones it uses |

Reading order is dependency order. A view or automation follows the slices that produce what it
consumes; sibling features and modules follow the same order; a feature's own slices come before its
sub-features. So a slice that uses events of several sub-features belongs in a sub-feature of its own
(for example `Viewing` for the views of a feature), not in the parent.

The generated `.screenplay` compiles with the Screenplay compiler (`screenplay x.play`): a read model
shared by several views is declared once, `produces` names the stream (`for id`), and property names
are plain identifiers.

## Build and troubleshoot

- The explorer is built from `Source/event_model_viewer` into the package; a git dependency lacks
  `priv/event_model` (it is built at publish), so use a released package or a built checkout.
- Run `MIX_ENV=dev mix compile` to regenerate; the files only change when the content does.
- A slice missing from the board is usually in a namespace the application does not discover, or has
  no command, read model, reducer, projection or reactor.
