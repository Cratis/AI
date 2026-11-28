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
