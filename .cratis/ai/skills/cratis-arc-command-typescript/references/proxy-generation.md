## Generate metadata and proxies

Verified at `Cratis/Arc.TypeScript` **v0.57.2** (source preview):
`Source/Tools/ProxyGenerator/parseSourceOptions.ts`,
`Documentation/proxy-generation/getting-started.md`, and sample generator scripts.

`arc-proxygenerator` (package `@cratis/arc.proxygenerator`, also unpublished)
reads the TypeScript source with the compiler API — it never queries a running
server. It writes server metadata and client proxies in one run. The CLI
rejects relative paths, and the output folder must exist:

```javascript
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const path = relative => fileURLToPath(new URL(relative, import.meta.url));
const cli = fileURLToPath(new URL('./cli.js', import.meta.resolve('@cratis/arc.proxygenerator')));
mkdirSync(path('./generated'), { recursive: true });
const result = spawnSync(process.execPath, [cli,
    '--project', path('./tsconfig.json'),
    '--artifacts', path('./Features'),
    '--output', path('./generated'),
    '--metadata', path('./Features/generatedMetadata.ts'),
    ...process.argv.slice(2)], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
```

- Commit the metadata module; never edit it. Regenerate after **every** change
  to a command, read model or validator — `useGeneratedMetadata` throws
  `Stale generated artifact metadata for <Type>` otherwise. Reordering
  parameters without changing their count goes undetected, so gate CI with
  `--check-metadata` and keep `--watch` running beside `tsx` while developing.
- `--artifacts` must be the folder passed to `discover()`. Match route options
  (`--api-prefix`, `--segments-to-skip`, `--root-namespace`) to the server's
  `generatedApis` options, or proxies call URLs the server does not serve.
- Generated proxies import the **published** `@cratis/arc` and
  `@cratis/arc.react` (docs/sample pins **22.45.0**) plus `@cratis/fundamentals`;
  the UI samples pin `@cratis/components` 4.23.0. Compile in strict `Bundler`
  resolution with `skipLibCheck: false`, `experimentalDecorators: true`, and
  import `reflect-metadata` once in the frontend entry. These published client
  declarations do not support NodeNext consumer compilation. Consuming proxies
  in React is `cratis-arc-react-page`.

### Co-locate proxies with the slice

The separate-output form above remains supported. To put proxies next to backend
artifacts, set `--output` to `Features` (or its ancestor/nested folder) and add
**`--use-proxy-file-suffix`**. This is required for overlapping output. The
samples emit `RegisterAuthor.proxy.ts` beside `Registration.ts` and
`RegisterAuthorForm.tsx`, without barrels. `discover()` skips `*.proxy.ts/.tsx`;
server tsconfig excludes `Features/**/*.proxy.ts` and `Features/**/*.tsx`.
Never give a `.tsx` file the same basename as the backend slice `.ts`.

`--watch` regenerates on backend edits; the generator overwrites/deletes only
its own output. A web bundler reading slice files outside the web project must
still lower the proxies' legacy decorators: Vite 8 uses
`oxc: { decorator: { legacy: true } }`.

| Additional flag | Effect |
| --- | --- |
| `--skip-react-hooks` | No React import or generated `use*`/`when` hooks |
| `--type-mapping <Type>=<package>[#<export>]` | Repeatable external mappings (`typeMappings` in programmatic options) |
| `--watch-poll-interval <ms>` | Poll fallback; requires `--watch`; 0 disables polling |
| `--js-import-specifiers` | `.js` specifiers for compiled NodeNext ESM; does not fix client declaration compatibility |
| `--emit-interfaces` | Emit model interfaces |
| `--skip-index-generation` | Do not emit barrels |
| `--skip-output-deletion` | Retain stale generated output; use deliberately, not to hide drift |
