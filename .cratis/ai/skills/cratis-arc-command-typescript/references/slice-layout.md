## Lay out the slice

Verified at `Cratis/Arc.TypeScript` **v0.57.2**:
`Samples/Library/Features/Authors/Registration` and sample generator scripts.

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
│   ├── RegisterTask.proxy.ts
│   ├── RegisterTaskForm.tsx
│   └── for_RegisterTask/when_registering/with_valid_title.ts
└── Listing/
    └── Listing.ts
```

Co-location needs `--use-proxy-file-suffix` with the artifacts folder as
`--output`; no barrels. Exclude proxies and TSX from server compilation and
lower proxy decorators in the frontend bundler. Read
[proxy-generation.md](proxy-generation.md) when configuring the overlapping
output or watch mode. Separate output is still supported.
