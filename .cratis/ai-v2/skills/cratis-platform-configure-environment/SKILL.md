---
name: cratis-platform-configure-environment
description: Use when configuring an isolated Library deployment that needs a host connection and a named model secret without committing their values. Not for changing host discovery (use cratis-arc-host-application).
compatibility: Requires ASP.NET Core configuration and the Screenplay CLI for model inventory.
---

# Bind the Library preview environment

1. In the preview host's deployment configuration, supply `Cratis__Chronicle__ConnectionString` through its secret provider. Do not place shared endpoints or credentials in the model or in the preview host's checked-in settings.
2. In the preview host's `Program.cs`, immediately after creating `WebApplicationBuilder builder` and before Chronicle registration, reject a missing effective value:

   ```csharp
   if (string.IsNullOrWhiteSpace(builder.Configuration["Cratis:Chronicle:ConnectionString"]))
       throw new System.InvalidOperationException("Missing Chronicle connection string");
   ```

   This guard checks presence only. Require the resolved endpoint to match the preview deployment's allowed endpoint and probe the expected store and namespace from the consuming app before calling the binding healthy. Report a mismatch without logging the supplied value.
3. For Library reminder mail using the mail extension contract with the `apiKey` setting, put this declaration in `model/environment.play`:

   ```play
   secret MailerApiKey

   system Mailer
     extension "ghcr.io/cratis/extension-mail" version 2
     setting apiKey from secret MailerApiKey
   ```

4. Run `screenplay environment model --format json`. Look for `secrets.MailerApiKey` marked secret. The output lists paths and secret flags, not values. Bind the named secret in the deployment's secret store.

## Bind an already-running local service

Choose the orchestrator's resource binding when an existing Aspire AppHost supplies the `chronicle` reference. Check `builder.Configuration["ConnectionStrings:chronicle"]` rather than requiring the preview key, then probe the local store and namespace. A Compose network changes the reachable host and port from inside the app's container; it does not define another configuration source.

## When it goes off the usual path

- **Aspire supplies a local reference but the app reaches another store:** check for an inherited `Cratis:Chronicle:ConnectionString` or an explicit value in client registration. Remove the override and probe again from the app without printing the connection string.

## Avoid

- Don't expect this CLI inventory to list implicit extension settings or the effective Chronicle connection string. It inventories the model, not the host.
- Don't print a connection string when reporting a missing or unreachable service.

## Related skills

- [Connect Chronicle](../cratis-chronicle-connect-application/SKILL.md) to configure the Library host after checking its required settings.
