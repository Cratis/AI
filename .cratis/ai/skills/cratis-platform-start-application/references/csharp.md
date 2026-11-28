# .NET scaffold

Use the .NET 11 SDK. The React variants also need npm and Node.js `^20.19.0` or `>=22.12.0`.

## Default: Arc and React with Compose

```sh
cratis new cratis --language csharp -n Library -o Library --version 1.9.2 --packageManager npm --allow-scripts no
cd Library
```

Use profile `cratis/application/csharp` and languages `csharp,typescript`. After the shared AI and Compose checks, run `npm install` and start `dotnet run` from `Library`. The build generates TypeScript proxies and the backend listens on `http://localhost:5000`. In a second terminal in `Library`, run `npm run dev` and do the React smoke check.

## Aspire: Arc and React with an app host

Choose this when Aspire should orchestrate the local backend and infrastructure.

```sh
cratis new cratis-aspire --language csharp -n Library -o Library --version 1.9.2 --allow-scripts no
cd Library
```

Use profile `cratis/application/csharp` and languages `csharp,typescript`. After the shared AI check, run `npm install` in the nested `Library` project directory. From the solution directory, run `dotnet run --project Library.Composition`. Open the dashboard link printed by the app host and verify the backend and Chronicle resources are running. In a second terminal in the nested `Library` project, run `npm run dev` and do the React smoke check. Vite targets `http://localhost:5000`; if the backend reports a different local address, point Vite's proxies at that address.

## Chronicle only: console or web client

Choose this when the application needs Chronicle but not Arc or React. Use the console template by default; use `cratis-chronicle-web` in place of `cratis-chronicle-console` when an ASP.NET Core HTTP host is needed.

```sh
cratis new cratis-chronicle-console --language csharp -n Library -o Library --version 1.9.2 --allow-scripts no
cd Library
```

Use profile `cratis/application/chronicle-dotnet` and language `csharp`. After the shared AI and Compose checks, run `dotnet run` in `Library`:

- **Console:** run in an interactive terminal. The reactor should print the sample `Hello world!` message. Press a key to exit.
- **Web:** from another terminal, request `http://localhost:5000/` to append a disposable event, then `http://localhost:5000/projection` to read it back. The append should report success and the projection should show `Hello, Chronicle!`. The demo uses GET for its append; use POST for state-changing routes in the real application.
