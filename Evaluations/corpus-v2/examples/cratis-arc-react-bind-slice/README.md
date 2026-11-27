# Render an observable author query

Run from this directory with the .NET SDK required by the [proxy producer](../cratis-arc-generate-proxies/README.md), Node 24 and npm. Generate the proxy files first; the test copies the producer's output instead of substituting handwritten proxy classes.

```sh
dotnet build ../cratis-arc-generate-proxies/Library.csproj -c Release
npm install --legacy-peer-deps
npx playwright install chromium
npm run test:example
```

The test type-checks the consumer, starts a local Vite server with a fixture event stream, and opens Chromium. It checks that a successful empty result displays “No authors yet.”, a blank search asks for input, and seeded authors appear without reloading. This checks rendering and the query binding, not production authorization or the command write path. The fixed example uses direct query transport to match the fixture; keep the normal Arc transport defaults in an application.
