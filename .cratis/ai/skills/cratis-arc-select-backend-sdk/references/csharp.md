# C#: choose the application host

For an ASP.NET Core project, [start an Arc host](../../cratis-arc-host-application/SKILL.md) with `AddCratisArc`, then `UseCratisArc` on the built application. This does not select an event store. Choose the Chronicle integration explicitly if the service must append events.

For a retained ASP.NET Core MVC receipt endpoint, use the controller's existing route and test its actual result and authorization. Don't move it to a model-bound API only to reuse a sample request.
