# Project setup and bootstrap for Arc for TypeScript

This reference holds the install path, compiler and decorator settings, and the application bootstrap with its builder calls.

## Set up a project

Install the server packages from npm (stable 1.0.0), then add the host adapter and storage packages the application needs:

```bash
npm install @cratis/arc.core @cratis/fundamentals @opentelemetry/api
npm install --save-dev @cratis/arc.testing @cratis/arc.proxygenerator @cratis/eslint-plugin-arc-core
```

| Add | When |
| --- | --- |
| `@cratis/arc.express`, `@cratis/arc.fastify` or `@cratis/arc.hono` | The application mounts into an existing web framework instead of the standalone host |
| `@cratis/arc.mongodb`, `@cratis/arc.drizzle` | MongoDB or SQL read models |
| `@cratis/arc.chronicle`, or `@cratis/platform` (meta package) for the composed builder | Event sourcing with Chronicle |
| `rxjs` | RxJS observable queries (optional peer of the core) |

`Samples/Tasks` and `Samples/Library` in `Cratis/Arc.TypeScript` are runnable references for the slice layout.

- Node.js 22.19 or later (the core runs on 22; the workspace build needs 22.19;
  24 LTS is recommended).
- ES modules only: `"type": "module"` in `package.json`.
- Peer dependencies of `@cratis/arc.core`: `@cratis/fundamentals`,
  `@opentelemetry/api`; `rxjs` is an optional peer, needed for
  RxJS observable queries.
- TypeScript: the repository and proxy generator use TypeScript 6
  (`typescript@npm:@typescript/typescript6`, command `tsc6`).

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "ESNext.Decorators"],
    "types": ["node"],
    "strict": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "rootDir": ".",
    "outDir": "dist"
  },
  "include": ["main.ts", "Features/**/*.ts"],
  "exclude": ["Features/**/*.proxy.ts", "Features/**/*.tsx"]
}
```

- **No `experimentalDecorators`.** Arc's decorators compile as standard TC39
  decorators, as the samples do; `ESNext.Decorators` declares `Symbol.metadata`.
  Legacy `experimentalDecorators` also work. The Library sample compiles its
  `@cratis/chronicle` 6.35 event types and projections under the same
  standard-decorator settings. Generated frontend proxies are the exception:
  they compile with `experimentalDecorators: true`.
- With `NodeNext`, relative imports carry a `.js` extension. `ESNext` +
  `Bundler` (the samples' choice) also works.
- Node's own type stripping does not transform decorators — `node main.ts`
  fails at the first `@`. Run source with `tsx watch main.ts` during
  development and compile with `tsc6` for production.
- A Vitest/Vite transform must lower standard decorators with
  `useDefineForClassFields: true` (`target: 'es2022'`,
  `experimentalDecorators: false`), or decorators silently do nothing in specs.

## Bootstrap the application

`Samples/Tasks/main.ts`:

```typescript
import { ArcApplication } from '@cratis/arc.core';
import { Tasks } from './Features/Tasks/Tasks.js';
import { metadata } from './Features/generatedMetadata.js';

const builder = ArcApplication.createBuilder();
builder.useGeneratedMetadata(metadata);
builder.services.addSingleton(Tasks);
await builder.discover(new URL('./Features/', import.meta.url));
export const app = await builder.build();
await app.run({ port: Number(process.env.PORT ?? 3000) });
```

| Call | Effect |
| --- | --- |
| `ArcApplication.createBuilder(options?)` | Starts the application; the Node builder reads `appsettings.json` (`Cratis:Arc`) and `Cratis__...` environment variables |
| `useGeneratedMetadata(metadata)` | Installs parameter and return-type metadata extracted from source. Call it **before** `discover()`/`add()` |
| `services.addSingleton(Token)` | Registers a service; `addScoped`/`addTransient` take factories. Classes can also carry `@singleton()`, `@scoped()`, `@transient()` |
| `discover(folderUrl)` | Imports every module under the folder and registers **exported**, decorated artifacts. Skips `dist`, `node_modules`, `given`, `for_*`, `index.*`, declaration files and `*.proxy.ts/.tsx` |
| `add(...types)` | Registers artifacts explicitly — required on the Fetch entry, which cannot discover |
| `build()` | Validates the whole graph (missing services, lifetime mismatches, misplaced decorators, stale metadata) and throws before any listener opens |
| `app.run()` / `app.start()` | Standalone Node host. `app.dispose()` stops it and disposes services |

`discover()` refuses a folder containing the entry point; use `Features/`.
`Cratis:Arc:Development: true` is local-only.
