# Reject invalid input before the write

For synchronous Java validation implement `BlockingCommandValidator<CreateTask>`. Return `CreateTask.class` from `getCommandType()` and implement `List<ValidationResult> validate(CreateTask command, CommandContext context)`. Return `List.of(ValidationResult.error("Title is required", List.of("title")))` for a null or blank title and `List.of()` for valid input. Spring collects `CommandValidator<?>`, not bare blocking validators. Expose the adapter from a Spring configuration class:

```java
@Bean
CommandValidator<CreateTask> createTaskValidator() {
    return new BlockingCommandValidatorAdapter<>(new CreateTaskValidator());
}
```

Import `CommandValidator` from `io.cratis.arc.commands` and `BlockingCommandValidatorAdapter` from `io.cratis.arc.java`. Submit a blank title through the Spring-hosted pipeline; assert the `title` finding and zero handler calls. Submit a valid title and assert one call.

For fluent model rules extend `FluentModelValidator<CreateTask>` and call `super(CreateTask.class)` followed by `ruleFor("title").notEmpty().maxLength(80)` in the Java constructor. Run the registered rule on a real input to catch a misspelled field name.
