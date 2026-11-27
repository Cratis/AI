# Load the TypeScript service definition

In a disposable Node project, install the generated wire package, not the decorator-based application SDK:

```sh
npm init -y
npm install --save-exact @cratis/chronicle.contracts@19.184.3
node --input-type=module -e "import { ConnectionServiceDefinition, chronicleDescriptorSet } from '@cratis/chronicle.contracts'; if (!ConnectionServiceDefinition || !chronicleDescriptorSet.length) throw Error('missing wire contracts'); console.log(chronicleDescriptorSet.length)"
```

Expect a positive descriptor byte count. If the named import fails, inspect the resolved package and version with `npm ls @cratis/chronicle.contracts`. A service definition isn't a connected client. For RPCs the caller must supply a trusted channel and authentication metadata; for an application choose `@cratis/chronicle` rather than rebuilding its session handling.
