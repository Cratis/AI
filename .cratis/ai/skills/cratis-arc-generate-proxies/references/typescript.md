# Generate clients from Node source

Run `arc-proxygenerator --project tsconfig.json --artifacts Features --output Features --use-proxy-file-suffix --metadata "$PWD/Features/generatedMetadata.ts"` from the Library example project root, where registered classes live under `Features`. Use the actual slice path in other projects. The input is source, not a running server. The suffix keeps co-located proxies separate from handwritten artifacts. Load the generated metadata in the host. Stale runtime shapes can prevent startup; source-only changes can still escape the runtime check. Run the same command with `--check-metadata` in CI.

Match generator options to the server before debugging the client:

| Generator | Server |
| --- | --- |
| `--root-namespace` | discovery `rootNamespace` |
| `--api-prefix` | `generatedApis.routePrefix` |
| `--segments-to-skip` | `generatedApis.segmentsToSkipForRoute` |
| `--skip-command-name-in-route` | `generatedApis.includeCommandNameInRoute: false` |
| `--skip-query-name-in-route` | `generatedApis.includeQueryNameInRoute: false` |

## Output for the consumer

| Flag | Use when |
| --- | --- |
| `--type-mapping Shared.Money=@acme/money` | Reuse a shared type instead of generating it. Use the namespace-qualified declaration name; this emits `import { Money } from '@acme/money';`. For CLR types, use the C# reference. |
| `--js-import-specifiers` | Native Node ESM or NodeNext needs `.js` extensions on local imports. Leave it off for Vite and other bundlers. |
| `--skip-react-hooks` | A server-only or non-React consumer needs client classes without the `@cratis/arc.react` import or static `use*`/`when` helpers. |
| `--emit-interfaces` | Use interfaces instead of model classes. Leave it off when the client needs decorators or hydration into model instances. |
