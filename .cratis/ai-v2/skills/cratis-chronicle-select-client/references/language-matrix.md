# Contract evidence by runtime

| Runtime | Generated layer in Chronicle | What to verify independently |
|---|---|---|
| Python | `Source/Clients/Python`, protobuf messages and gRPC stubs | Import the generated module; serialization alone doesn't append. |
| TypeScript | `Source/Clients/TypeScript`, package consumer checks | The TypeScript SDK returns an `AppendResult` per event. Without an expected position it requests no optimistic check. |
| Kotlin/JVM | `Source/Clients/Kotlin`, generated contracts | The JVM SDK defaults to `ConcurrencyScope.none`; a batch returns a list of per-event append results. |
| Elixir | `Source/Clients/Elixir`, generated protocol modules | The Elixir SDK sends no scope by default. `concurrency: [default: :optimistic]` enables a scoped tail check; `append_with_result/3` exposes positions and refusals rather than just `:ok`. |

For a requested operation, cite a native invocation and observable outcome. Where only the wire message is verified, report that boundary instead of projecting another client's method names onto it.
