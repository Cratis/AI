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

   This guard checks presence only. For a single-host preview binding with no client override, parse the value with `new ChronicleConnectionString(builder.Configuration["Cratis:Chronicle:ConnectionString"]!).ServerAddress` (`using Cratis.Chronicle.Connections;`). Compare its `Host` and `Port` with the deployment's allowed pair; reject a mismatch without logging the value.
3. For Library reminder mail using the mail extension contract with the `apiKey` setting, put this declaration in `model/environment.play`:

   ```play
   secret MailerApiKey

   system Mailer
     extension "ghcr.io/cratis/extension-mail" version 2
     setting apiKey from secret MailerApiKey
   ```

4. Run `screenplay environment model --format json`. Look for `secrets.MailerApiKey` marked secret. The output lists paths and secret flags, not values. Bind the named secret in the deployment's secret store.

## Bind an already-running local service

When an existing Aspire AppHost supplies the `chronicle` reference, check `builder.Configuration["ConnectionStrings:chronicle"]` rather than requiring the preview key.

## Prove the app reached the intended store and namespace

In a smoke check running in the app, resolve `var eventStore = scope.ServiceProvider.GetRequiredService<IEventStore>();` from the app's service scope (`using Cratis.Chronicle;`). Check `eventStore.Name.Value` and `eventStore.Namespace.Value` against the expected values. Read a fixture registration already seeded only in that target with `await eventStore.EventLog.GetFromSequenceNumber(EventSequenceNumber.First, fixtureAuthorId)` (`using Cratis.Chronicle.Events;`). Require the known registration, not merely a successful connection. Use the same check for Aspire and preview.

## When it goes off the usual path

- **Aspire supplies a local reference but the app reaches another store:** check for an inherited `Cratis:Chronicle:ConnectionString` or an explicit value in client registration. Remove the override and repeat the fixture read from the app without printing the connection string.

## Avoid

- Don't expect this CLI inventory to list implicit extension settings or the effective Chronicle connection string. It inventories the model, not the host.
- Don't print a connection string when reporting a missing or unreachable service.

## Related skills

- [Connect Chronicle](../cratis-chronicle-connect-application/SKILL.md) to configure the Library host after checking its required settings.
