# Bind the Node command handler

Export a `@command()` class from the feature. Describe input properties with `@field` and keep injected services on the handler signature:

```typescript
@command()
export class RegisterTask {
    @field(TaskId) id!: TaskId;
    @field(TaskTitle) title!: TaskTitle;

    handle(tasks: Tasks): TaskId {
        tasks.register(this.id, this.title);
        return this.id;
    }
}
```

Register the service and load current generated metadata, or supply explicit binding descriptors. TypeScript erases parameter types. Build the host to detect unbound dependencies; explicit descriptors take precedence over generated inference. For an event-producing handler return the fact to the configured Chronicle integration and check that the owning ID's history contains it once.
