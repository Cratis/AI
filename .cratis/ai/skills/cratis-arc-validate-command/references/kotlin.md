# Reject invalid input before the write

Register a Spring component implementing `CommandValidator<CreateTask>`. Set `commandType` to `CreateTask::class.java` and implement `override suspend fun validate(command: CreateTask, context: CommandContext): List<ValidationResult>`. Return `listOf(ValidationResult.error("Title is required", listOf("title")))` for a blank title, `emptyList()` otherwise. Use the rule builder for reusable field rules. Enforce uniqueness or expected version at the guarded append, not by performing a racy query in a field validator.
