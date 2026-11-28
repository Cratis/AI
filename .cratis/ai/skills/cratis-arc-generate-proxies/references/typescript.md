# Generate clients from Node source

Run `arc-proxygenerator --project tsconfig.json --artifacts Features --output Features --use-proxy-file-suffix --metadata "$PWD/Features/generatedMetadata.ts"` from the project root when the registered classes live under `Features`. The input is source, not a running server. The suffix keeps co-located proxies separate from handwritten artifacts. Load the generated metadata in the host. Stale runtime shapes can prevent startup; source-only changes can still escape the runtime check. Run the same command with `--check-metadata` in CI.

Match generator options to the server before debugging the client:

| Generator | Server |
| --- | --- |
| `--root-namespace` | discovery `rootNamespace` |
| `--api-prefix` | `generatedApis.routePrefix` |
| `--segments-to-skip` | `generatedApis.segmentsToSkipForRoute` |
| `--skip-command-name-in-route` | `generatedApis.includeCommandNameInRoute: false` |
| `--skip-query-name-in-route` | `generatedApis.includeQueryNameInRoute: false` |

## Output options

- `--type-mapping Shared.Money=@acme/money` reuses a shared type instead of generating it, emitting `import { Money } from '@acme/money';`. Use the namespace-qualified source declaration name. For CLR types, use the mapping in the C# reference instead.
- `--skip-react-hooks` omits the React hooks for non-React or server-only consumers.
- `--js-import-specifiers` emits `.js` extensions on local imports for ESM/NodeNext.
- `--emit-interfaces` emits model interfaces instead of classes. Keep classes when consumers need decorators or hydration into model instances.
