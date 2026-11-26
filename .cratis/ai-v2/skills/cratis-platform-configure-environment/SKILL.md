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

   This guard checks presence, not the destination. If preview clients can inherit a separate shared endpoint, also require the effective endpoint to equal the preview deployment's allowed endpoint before use. Report a mismatch without logging the supplied value. Exercise the configured preview service separately before reporting it reachable.
3. For Library reminder mail using the mail extension contract with the `apiKey` setting, put this declaration in `model/environment.play`:

   ```play
   secret MailerApiKey

   system Mailer
     extension "ghcr.io/cratis/extension-mail" version 2
     setting apiKey from secret MailerApiKey
   ```

4. Run `screenplay environment model --format json`. Look for `secrets.MailerApiKey` marked secret. The output lists paths and secret flags, not values. Bind the named secret in the deployment's secret store.

## Bind an already-running local service

For a Compose-hosted Library app, supply `Cratis__Chronicle__ConnectionString` to the **app** with an endpoint reachable from that container, not a host-only address. Apply the same presence and destination checks as for preview.

In an existing Aspire AppHost where the Library project references the resource named `chronicle`, the app receives `ConnectionStrings__chronicle`. Check `builder.Configuration["ConnectionStrings:chronicle"]` rather than requiring the preview key in this environment. Leave the explicit Chronicle connection string unset in both host settings and client registration: either would override the resource binding. Verify the app reaches the intended local store without printing the value.

## Avoid

- Don't expect this CLI inventory to list implicit extension settings or the effective Chronicle connection string. It inventories the model, not the host.
- Don't print a connection string when reporting a missing or unreachable service.

## Related skills

- [Connect Chronicle](../cratis-chronicle-connect-application/SKILL.md) to configure the Library host after checking its required settings.
