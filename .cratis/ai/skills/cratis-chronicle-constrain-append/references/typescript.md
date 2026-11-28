# Define the Node constraint

With registered `ProjectCreated` and `ProjectRemoved` events, decorate the `IConstraint` implementation with `@constraint()`. In `define(builder: IConstraintBuilder)` use `builder.unique(u => u.on(ProjectCreated, e => e.name).removedWith(ProjectRemoved));`. Load the constraint with the application artifacts. Prove a duplicate from a different source is rejected before interpreting a successful release as reuse.
