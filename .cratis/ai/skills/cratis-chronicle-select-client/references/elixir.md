# Load the Elixir wire contracts

In a Mix project using Elixir 1.18 or later, add `{:cratis_chronicle_contracts, "== 19.184.3"}` to `deps/0` in `mix.exs`. Then run:

```sh
mix deps.get
mix run -e 'alias Cratis.Chronicle.Contracts.DescriptorSet; true = byte_size(DescriptorSet.bytes()) > 0; IO.puts(DescriptorSet.protocol_version())'
```

Expect `19.184.3`. If dependency resolution fails, check the gRPC major requirements: these contracts need grpc 1.x. Don't force them into a client requiring grpc 0.11. The generated message and stub modules don't supervise application observers. For an actual gRPC call configure a trusted channel; when using Mint select `GRPC.Client.Adapters.Mint` explicitly.
