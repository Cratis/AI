# Select the Node application client

In the Node server, depend on `@cratis/chronicle`. For example, with the 6.77.0 client the application import is:

```ts
import { ChronicleClient } from '@cratis/chronicle';
```

Build the server and inspect its resolved dependencies. That client requires `@cratis/chronicle.contracts` **19.188.0**, not 6.77.0. If the import fails and only the contracts package is installed, fix the direct application dependency. Loading a generated service definition is a protocol check, not evidence that the application client can register observers.
