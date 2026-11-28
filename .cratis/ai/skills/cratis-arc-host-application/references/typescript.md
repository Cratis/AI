# Start a Node host

Use the Node application builder when the server should load host configuration. Explicit options override configuration; the Fetch entry point does not load configuration files. With generated metadata and features in the same package as the entry point:

```typescript
import { ArcApplication } from '@cratis/arc.core';
import { metadata } from './Features/generatedMetadata.js';

const builder = ArcApplication.createBuilder();
builder.useGeneratedMetadata(metadata);
await builder.discover(new URL('./Features/', import.meta.url));
const app = await builder.build();
await app.run({ port: 3000 });
```

Register dependencies required by the discovered features before building. In an existing Express, Fastify or Hono service, mount the adapter on the existing host instead of starting a second listener. Mount the WebSocket transport separately if a client observes live queries; a successful finite HTTP query only proves HTTP registration. In native-principal mode, bridge the WebSocket upgrade through its own verified native-context callback. The HTTP middleware callback does not secure the upgrade.

When the Node builder loads configuration, explicit code options override configured settings. A Fetch-only entry point does not read host configuration for you: supply the options explicitly. Development identity providers and detailed exception responses are independent settings; enabling one is not a reason to expose the other.
