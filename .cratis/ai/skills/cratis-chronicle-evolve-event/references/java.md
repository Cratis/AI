# Map the Java class pair

Give the migration a public no-argument constructor invoking `super(PersonV2.class, PersonV1.class)` on `EventTypeMigration<PersonV2, PersonV1>`. In `upcast` use `builder.renamedFrom("fullName", "name")`; in `downcast` use `builder.renamedFrom("name", "fullName")`. Use exact property names. Test a stored V1 record, not only the generated mapping document.
