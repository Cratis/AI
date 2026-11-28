# Execute verified bodies in a host

Standalone `screenplay` supplies no body provider. A reached opaque rule, `validate`, policy, handler or reducer body is Unsupported, never passing. Use a host only when it can admit and run the resolved, content-verified bodies:

- Supply an `ISemanticBodyExecutionProviderFactory` and resolved bodies to `SemanticEvaluator` or `SemanticSpecificationRunner`. To expose a configured MCP runner, use `ScreenplayMcpServer.RunConfigured(new ScreenplayMcpRun(root, factory, cancellationToken), input, output)`. The runtime creates one isolated provider per execution or selected specification run and disposes it before returning.
- `ValidateAsync` returns `Valid`, `Invalid` (ordered rejection messages) or `Unsupported`. `AuthorizeAsync` returns Allow, Deny or Unsupported; missing, unsupported or faulting policy execution fails closed, not as allow. `ReduceAsync` returns `Next` or `Delete`; unsupported reduction leaves the original world unchanged.
- Check the whole `HandleAsync` result before any append: declared event identities, payloads and destinations, including `for one of` membership. Invalid output or refused admission is Unsupported, not a domain rejection. No earlier item may commit from a malformed result.
- An admitted handler fault raises `SemanticCommandBodyFaultException` with a typed kind. Cancellation requested through the run token propagates `OperationCanceledException`; an unrequested cancellation is a typed handler fault. Neither is a domain rejection or denial.

Screenplay ships no C# executor. The host owns API admission, process isolation and resource limits; `pure` is not a sandbox. Use the supplied body context, not invented reads or host services.

Version floors: Screenplay 4.256.0 for policy and v1 handler bodies; 4.257.0 for the v2 provider seam; 5.4.0 for authoring `may produce` in Screenplay (ESM v35).
