# Register adjacent Go generations

Register the current type with `events.WithID("customer-registered")` and `events.WithGeneration(2)`. Register `previous, err := chronicle.RegisterEventGeneration[CustomerRegisteredV1](registry, current, 1)` and check the error. Pass `current, previous` and `events.Migration[CustomerRegistered, CustomerRegisteredV1]{Upcast: up, Downcast: down}` to `chronicle.RegisterEventMigration(registry, ...)`. Do not reverse the type parameters of the upcast. Check registration errors before a read or replay test.
