# Exercise a Java backend

Use `io.cratis:arc-testing` and the Java facades in `io.cratis.arc.testing.java`. Supply the application's generated artifact module. A blocking JUnit test can keep setup and shutdown local:

```java
try (var scenario = new BlockingCommandScenario<OrderProduct>(module, OrderProduct.class)) {
    scenario.execute(new OrderProduct(productId, 3)).shouldSucceed();
}
```

Obtain the typed response with `shouldHaveResponse(Response.class)`, then assert the relevant field on that returned object. The helper checks non-nullness and assignability, not field values. Use `BlockingQueryScenario` for a snapshot. For an asynchronous contract `AsyncCommandScenario` takes a caller-owned coroutine scope and returns a `CompletionStage` from `execute`; await its completion before asserting.

For Chronicle appends use `io.cratis:chronicle-testing`: construct `new EventScenario("testing", "default")`, then wrap `scenario.getEventSequence()` in `io.cratis.chronicle.java.BlockingEventSequence`. Assert `append(sourceId, event).isSuccess()`. Java does not support the model-bound read-model scenario workflow. Test the reducer's decision directly; use a running kernel for constraint enforcement, projection execution, persistence or observer delivery.
