---
name: cratis-platform-configure-environment
compatibility: .NET SDK and the application's configuration providers.
description: Use when appsettings, Aspire or docker compose must bind service endpoints and credentials separately per environment. Not for changing Arc discovery (cratis-arc-host-application).
---

# Bind the host to the intended environment

1. Inventory each required key, its owner, whether it is secret, and which host consumes it. For a Screenplay provider use its declared identity or alias to find the requirement keys; the model declares requirements, not values. **Done:** a names-only contract with no credentials, URIs containing credentials, or fallback shared targets.
2. Default to explicit host bindings for the selected composition. Keep nonsecret local endpoint settings separate from credentials supplied by the host's secret provider. Validate the **resolved** configuration before connecting: check required values, scheme, host, port and resource identity against the intended disposable target. Never infer isolation from an environment label. Read references/local-services.md when translating names between the model, .NET configuration and local services. **Done:** an allowlisted target and a secret-presence check, without making a service call.
3. Omit one required setting and repeat startup validation; also try an unintended endpoint with all keys present. **Done:** both attempts stop before I/O, naming only the offending key. Remove any code default that silently converts a missing binding into a shared or development connection.
4. Supply the missing setting through the disposable host provider, keeping the endpoint local. **Done:** a bounded diagnostic identifies the allowed target and says nothing about the credential value. Test its absence on success *and* failure. Once bindings are correct, hand connection or namespace setup to [Connect once, select the logical target explicitly](../cratis-chronicle-connect-application/SKILL.md); if types are not discovered in an otherwise configured host, use [Discover a slice in a web host](../cratis-arc-host-application/SKILL.md).

For example, bind a preview service's `Preview__Credential` environment variable as `Preview:Credential` after stripping its configured prefix. Neither key is an Arc or Chronicle setting:

```csharp
        using var settings = new ConfigurationManager();
        settings.AddEnvironmentVariables(prefix);
        if (settings["Preview:Endpoint"] != Allowed) throw new InvalidOperationException("Invalid Preview:Endpoint");
        if (string.IsNullOrWhiteSpace(settings["Preview:Credential"])) throw new InvalidOperationException("Missing Preview:Credential");
```

**Requires (Compose-hosted checks):** Confirm `docker compose version` and `docker info` succeed. Without a local daemon, exercise the configuration provider in process and leave container wiring unverified.

Run `dotnet test -c Release` in the application's binding spec project. Expect the allowed target on success and only the offending key on failure; neither path may print the credential or contact a service.
