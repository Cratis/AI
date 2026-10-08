## Generate metadata and proxies

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
  `@cratis/arc.react` (the docs pin `22.19.1`) plus `@cratis/fundamentals`.
  Compile them in `Bundler` resolution with `experimentalDecorators: true`, and
  import `reflect-metadata` once in the frontend entry. Consuming the proxies in
  React is `cratis-arc-react-page`.
