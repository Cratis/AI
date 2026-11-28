# Reject invalid input before the write

For synchronous Java validation implement `BlockingCommandValidator<CreateTask>`. Return `CreateTask.class` from `getCommandType()` and implement `List<ValidationResult> validate(CreateTask command, CommandContext context)`. Return `List.of(ValidationResult.error("Title is required", List.of("title")))` for a null or blank title and `List.of()` for valid input. Register the validator with the host. Submit the command through the Java pipeline; assert the `title` finding and that the handler was not invoked, then test a valid title.

For fluent model rules extend `FluentModelValidator<CreateTask>` and call `super(CreateTask.class)` followed by `ruleFor("title").notEmpty().maxLength(80)` in the Java constructor. Run the registered rule on a real input to catch a misspelled field name.
