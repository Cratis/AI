---
name: cratis-observability
description: Use when an application or kernel must export traces, metrics and logs across services or change published telemetry. Not for inspecting a Chronicle observer checkpoint (use cratis-chronicle-inspect-observer).
compatibility: An OpenTelemetry-compatible collector and access to the application's runtime configuration.
---

# Follow one operation across the service boundary

Give each logical service a stable name, configure the intended exporter and start with one synthetic command. Follow its trace from the application to the kernel, then check the outcome and duration. Configure each process separately. Do not turn source IDs, URLs, payloads or raw exception messages into metric labels. Verify the exported data, not just the configuration.

- `.csproj`: [configure the application and choose a source-ID policy](references/csharp.md). For [sampling, resources or cardinality](references/dotnet-setup-and-options.md), inspect the host options; for an [Arc or Chronicle signal](references/arc-and-chronicle-signals.md), select the instrument by scope.
- `mix.exs`: [attach a native handler and verify trace propagation](references/elixir.md).
- Kernel deployment: [configure kernel export and observer alerts](references/chronicle-kernel-export.md).
- Node, Kotlin, Java, Go and Python: no shared application setup helper is verified here. Use the host's supported OpenTelemetry SDK and an explicit exporter; do not translate .NET configuration calls.

If no span arrives, [check the source, propagation and exporter](references/troubleshooting.md) before changing sampling. A root span from each process is not a connected trace. Stop if a synthetic source identifier or protected content appears where the selected redaction policy forbids it.

## Published names are a contract

Renaming, changing the unit of, or removing a published span, metric or attribute breaks consumers. Document additive changes and version them as minor. For a replacement, emit both forms for at least one minor release and document the old form as deprecated. For example, emit metrics A and B together, tell dashboard and alert owners to move to B, then remove A in the next major release.
