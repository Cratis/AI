# Execute through the command pipeline

Call the owning application, not `handle/2`: `result = Cratis.Arc.execute(MyApp.Arc, command, principal: principal, tenant: tenant)`. Supply verified identity and authorized tenant, not caller-supplied membership. Use `Cratis.Arc.CommandResult.success?(result)` before reading a response. For wire-shaped input pass `{CommandModule, input_map}` to bind first. Validation-only is not execution. A Chronicle constraint or concurrency conflict is a validation finding; an exception is a different failure. Verify a refused command appended nothing.
