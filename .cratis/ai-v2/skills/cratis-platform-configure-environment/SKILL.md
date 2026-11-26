---
name: cratis-platform-configure-environment
description: Binds per-environment settings and secrets outside the application model. Use when configuring local composition, service settings or credentials. Not for changing Arc discovery (use cratis-arc-host-application).
compatibility: .NET SDK and the application's configuration providers.
---

# Supply environment values through the host

Declare the requirement by name in the model. Supply the value through configuration for the selected host; neither the model nor an event should carry the credential.

1. Keep service credentials out of `model/` and `appsettings.json`. In the Library model, refer to a secret by name, not its value.
2. Inventory the model's explicit requirements. For deployment include implicit extension settings by passing the parsed application and restored contracts to `EnvironmentRequirements.For(application, contracts)` from the `Cratis.Screenplay.Environments` namespace of the `Cratis.Screenplay` package.
3. Bind values through the intended environment's host configuration. Keep `Cratis__Chronicle__ConnectionString` there, not in an event payload.
4. Check that the application resolves its settings without printing values. Test connectivity separately against the intended service.

## Bind the Library's Chronicle connection

In the Library's preview deployment, configure `Cratis__Chronicle__ConnectionString` in the host's environment using the deployment's secret provider. Do not commit its value to `appsettings.json`. ASP.NET Core exposes the setting to the application as `Cratis:Chronicle:ConnectionString`.

For Library loan reminders, assume the model already declares `system Mailer` with a restored extension contract that defines the `apiKey` setting. In `model/environment.play`, declare the secret at top level:

```play
secret MailerApiKey
```

Inside the existing `system Mailer` declaration add `setting apiKey from secret MailerApiKey`. Bind `MailerApiKey` through the deployment's secret provider, not in the `.play` file. From the directory containing `model`, list the required keys:

```sh
screenplay environment ./model --format json
```

Look for declared service requirements, not values. This command does not read `Cratis__Chronicle__ConnectionString` from the operating system. The CLI inventory omits implicit extension settings. The contract-aware inventory also includes unmapped `systems.<System>.<setting>` keys and their secret flags.

## Avoid

- Don't put a credential literal in a `.play` file; bind by name.
- Don't treat inventory output as the effective settings installed on a host.
- Don't let a disposable Library host proceed without its own connection setting; fail startup instead of falling back to shared infrastructure.
- Don't report connectivity from successful configuration resolution; exercise the connection separately.

## Related skills

- [Host the Arc application](../cratis-arc-host-application/SKILL.md) for application registration.
- [Connect Chronicle](../cratis-chronicle-connect-application/SKILL.md) for the application's event-store connection.
