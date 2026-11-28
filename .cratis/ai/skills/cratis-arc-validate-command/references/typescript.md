# Reject invalid input before the write

Register a `@validator(RegisterTask)` class extending `CommandValidator<RegisterTask>`. In its constructor call `super()` then declare `this.ruleFor(command => command.title).notEmpty()` (and `maxLength` for the field's bound). Keep the rule on the real command property so callers receive the right member path. Execute an invalid payload through Arc, inspect the field and reason in the findings and verify no handler work occurred. Do not assert only a message or only an HTTP status.
