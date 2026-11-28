# Return the Java model from the handler

In an `@Reducer` class use `public EmployeeState employeeHired(EmployeeHired event, EmployeeState state, EventContext context)`. Initialize missing state, copy fields that are not changing, and return a new model keyed by `context.getEventSourceId()`. Test another event for that employee and a first event for a different employee. Do not rely on C# static method discovery.
