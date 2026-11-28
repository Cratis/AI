# Select the .NET application client

For a standalone .NET worker, reference `Cratis.Chronicle` from the worker project. For example, in a worker that uses Chronicle 20.0.0:

```xml
<PackageReference Include="Cratis.Chronicle" Version="20.0.0" />
```

Restore and build the worker. Its dependency graph should include the application client, not just contracts. Then exercise the operation the worker needs against a disposable namespace on the intended kernel. A successful restore says nothing about whether that kernel accepts the operation.
