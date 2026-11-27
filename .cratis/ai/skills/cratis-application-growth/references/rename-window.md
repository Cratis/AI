<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# The namespace rename window

A namespace rename is a change to stored identities, so it ships as one production rollout with a
repair, once, after the structural moves.

## 1. Prepare the code

1. **Replace name keys first, in their own commit:** authorization or audience rules keyed on a namespace
   prefix become explicit markers (an attribute, an assembly-level marker, a policy); OpenAPI or filter
   registrations scoped to one namespace take an explicit list; build steps that strip or include files by
   path use one shared pattern. Add a spec that lists what each marker covers, so a later rename cannot
   widen access unnoticed.
2. **Pin what can be pinned:** event types without an explicit id keep theirs while the class name stays.
   Pin an observer id only when its stored state must survive and you will not repair it.
3. **Rename:** project folders lose the product prefix, every namespace becomes
   `<Company>.<Product>.<Project>.<folder path>`, and `AssemblyName` stays unless the stored names are
   repaired too. Set Arc's `SegmentsToSkipForRoute` (and `CratisProxiesSegmentsToSkip`) to the length of the
   new prefix so routes and proxy folders do not grow it.
4. **Regenerate** every proxy, then search specs, scripts, documentation and reverse-proxy rewrites for
   literal routes and compare each with the generated ones.
5. **Bindings:** interface/implementation pairs that no longer share a namespace get an explicit or
   generated registration, applied after every explicit registration.

## 2. Build the repair

The repair renames stored identities from old full names to new ones before the new version starts:

| Stored identity | Typical location |
| --- | --- |
| Reactor, reducer and projection ids, observer state, failed partitions, replay state | the event store's system and per-namespace collections |
| Read model identifiers and definitions | the same collections; read model collections keep their names |
| Grain state type names | the Orleans storage |
| Job, job step and request type names | job storage |

Event types, events and read model content do not change.

The repair is a script with:

- a **mapping** generated from the old and new type catalogs, not typed by hand;
- a **test** that every changed identity maps to its new value and that pinned ids are untouched;
- a **dry run** that prints counts per collection, and a fuse that refuses to write above an expected count;
- **idempotence**: a second run changes nothing (prove it against a planted database);
- credentials read from an environment variable, never from the command line.

## 3. Run the window

1. Merge and publish the release; do not let it start against unrepaired storage.
2. Scale the application to zero, back up the affected collections, run the dry runs and compare their
   counts with the expected ones.
3. Apply the repair, clear any cached registrations the event store kernel holds (restart it when it caches
   them), then start the new version.
4. Check: no observer registered under a new id from position zero, no identity-drift warnings, every
   screen loads, stored jobs resume.

Rollback is the backup plus the previous release; keep both until the checks pass.
