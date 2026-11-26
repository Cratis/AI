---
name: cratis-platform-configure-environment
description: Use when an application needs separate environment settings, service endpoints or credentials for local composition. Not for changing Arc discovery (cratis-arc-host-application).
---

# Bind the host to the intended environment

1. Inventory each required key, its owner, whether it is secret, and which host consumes it. For a Screenplay provider use its declared identity or alias to find the requirement keys; the model declares requirements, not values. **Done:** a names-only contract with no credentials, URIs containing credentials, or fallback shared targets.
2. Default to explicit host bindings for the selected composition. Keep nonsecret local endpoint settings separate from credentials supplied by the host's secret provider. Validate the **resolved** configuration before connecting: check required values, scheme, host, port and resource identity against the intended disposable target. Never infer isolation from an environment label. Read references/local-services.md when translating names between the model, .NET configuration and local services. **Done:** an allowlisted target and a secret-presence check, without making a service call.
3. Omit one required setting and repeat startup validation; also try an unintended endpoint with all keys present. **Done:** both attempts stop before I/O, naming only the offending key. Remove any code default that silently converts a missing binding into a shared or development connection.
4. Supply the missing setting through the disposable host provider, keeping the endpoint local. **Done:** a bounded diagnostic identifies the allowed target and says nothing about the credential value. Test its absence on success *and* failure. Once bindings are correct, hand connection or namespace setup to `cratis-chronicle-connect-application`; if types are not discovered in an otherwise configured host, use `cratis-arc-host-application`.

Example: a private preview-service fixture maps `Preview__Endpoint` and `Preview__Credential` under its process-only prefix to `Preview:Endpoint` and `Preview:Credential`. These are application keys, not Arc or Chronicle settings. From the example directory run `dotnet build Specs --configuration Release -warnaserror`, then `dotnet test Specs --configuration Release --no-build`. Expect a loopback target summary, a missing-key diagnostic and rejection of the wrong endpoint without any credential disclosure or network traffic. This validates the binding, not service reachability.
