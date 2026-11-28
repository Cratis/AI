# Name the Java properties explicitly

In the Java `IConstraint` declaration, use `builder.unique(u -> { UniqueConstraintBuilderJavaBridge.on(u, PersonRegistered.class, "firstName", "lastName"); });`. Both properties together form the claim; this is not two independent unique constraints. Use the event property names, not display labels. Verify equal pairs collide across sources while a different pair can be recorded.
