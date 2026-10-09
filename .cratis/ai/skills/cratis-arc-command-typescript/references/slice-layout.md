## Lay out the slice

House convention (not a runtime requirement): one folder per behavior, one
TypeScript file named for the behavior holding the command, its validator and —
for Chronicle — its events. Concepts shared by several slices live one level up.
Specs sit beside the slice in `for_<Subject>/when_<action>/<case>.ts`, which
`discover()` skips.

```text
Features/Tasks/
├── TaskId.ts
├── TaskTitle.ts
├── Tasks.ts
├── Registration/
│   ├── Registration.ts
│   └── for_RegisterTask/when_registering/with_valid_title.ts
└── Listing/
    └── Listing.ts
```
