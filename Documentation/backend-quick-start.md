# Backend quick start: hello chat

This page takes you from an empty ASP.NET Core application to a first chat response from
`Cratis.AI`. It registers the backend, configures one provider, asks for a chat client by
purpose, and sends one message. Along the way it explains what a `LanguageModelPurpose` is and
how the package turns one into a concrete provider and model.

## What a purpose is

Your code never names a provider or a model. It names a **purpose**: what the call is for, such
as `"Conversation"` or `"IssueTriage"`. A `LanguageModelPurpose` is a string value. Any string is
a valid purpose, and you can write it directly where a purpose is expected:

```csharp
LanguageModelPurpose greeting = "Greeting";
```

Keeping provider and model choices out of your code means an operator can move a purpose to
another provider, a cheaper tier, or a pool without a code change.

### Which purposes exist

There is no fixed list you must pick from: you define the purposes your application needs. The
purposes the Cratis products use are collected as constants on `Cratis.AI.Agents.AgentPurposes`,
so you can reuse them instead of repeating strings:

`Conversation`, `IssueTriage`, `VisionGuardian`, `PlanGeneration`, `BuildFailureAnalysis`,
`WeeklyDigestAnalysis`, `AutoMergeClassification`, `WorkExecution`, `SecurityScreening`,
`ContentModeration`, `ContentCreation`, `ContentAuthoring`, `TaskExecution`, `BugFixing`, and
`SpeakingOpportunityScreening`.

### How a purpose becomes a provider and a model

A purpose resolves in three steps, all of them configuration you record through commands:

1. **Purpose to agent.** The `ConfigureAgent` command gives a purpose an agent: a name, a
   description, a `ModelTier` (`Fast`, `Balanced`, `Powerful` or `Premier`), and either one
   provider (`ProviderId`) or one pool of providers (`PoolId`).
2. **Agent to provider.** The agent's provider, or the member of its pool chosen at call time,
   serves the call.
3. **Tier to model.** Each provider maps tiers to concrete model names with the
   `SetAIProviderTierModels` command and its `TierModels` value. A tier you leave unmapped is
   filled in from the models the package discovers in the provider's catalog when the provider
   is added.

A purpose with no agent configured has nowhere to go: asking for it reports the agent as
unavailable, with a message that it has no AI provider or pool configured.

## Before you start

- A .NET 10 web application.
- A Chronicle server and MongoDB that your application can reach, for example both running
  locally on their default ports.
- An OpenAI API key, read from the `OPENAI_API_KEY` environment variable. Never put the key in
  source code or a committed configuration file.

Add the packages to the project:

```shell
dotnet add package Cratis
dotnet add package Cratis.Arc.MongoDB
dotnet add package Cratis.AI
```

## The complete example

Replace `Program.cs` with the following. Its three numbered parts are explained below.

```csharp
using Cratis.AI.Abstractions;
using Cratis.AI.Agents;
using Cratis.AI.Agents.Configuring;
using Cratis.AI.Configuration;
using Cratis.AI.Conversations;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Adding;
using Cratis.AI.Providers.SettingTierModels;
using Cratis.Arc;
using Cratis.Arc.Commands;
using Microsoft.Extensions.AI;

var builder = WebApplication.CreateBuilder(args);

// 1. Register the backend. AddCratisAI must come before AddCratis.
builder.Services.AddCratisAI(ai => ai.WithAgents<PurposeAgents>());
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton<
    Cratis.Chronicle.Identities.IIdentityProvider,
    Cratis.Chronicle.AspNetCore.Identities.IdentityProvider>();
builder.AddCratis(configureArcBuilder: arc => arc.WithMongoDB(mongo =>
{
    mongo.Server = "mongodb://localhost:27017";
    mongo.Database = "HelloChat";
}));

var app = builder.Build();
app.UseCratis();

var greeting = new LanguageModelPurpose("Greeting");

// 2. Configure one provider and point the purpose at it (local development only).
if (app.Environment.IsDevelopment())
{
    app.MapPost("/setup", async (ICommandPipeline commands, IConfiguration configuration) =>
    {
        var provider = await commands.Execute<AIProviderId>(
            new AddOpenAIProvider("OpenAI", configuration["OPENAI_API_KEY"] ?? string.Empty, 0));
        if (!provider.IsSuccess || provider.Response is null) return Results.BadRequest(provider);

        var tiers = await commands.Execute(new SetAIProviderTierModels(
            provider.Response,
            TierModels.NotSet with { Fast = "gpt-4.1-mini" }));
        if (!tiers.IsSuccess) return Results.BadRequest(tiers);

        var agent = await commands.Execute(new ConfigureAgent(
            greeting,
            "Greeter",
            "Answers the hello-chat sample.",
            ModelTier.Fast,
            ProviderId: provider.Response));
        return agent.IsSuccess ? Results.Ok() : Results.BadRequest(agent);
    });
}

// 3. Ask for a chat client by purpose and send one message.
app.MapGet("/hello", async (IAIChatClients chatClients) =>
{
    var response = await chatClients.For(greeting).GetResponseAsync("Say hello in one sentence.");
    return response.Text;
});

await app.RunAsync();

/// <summary>
/// Names the agent behind each purpose, so the events a chat causes are attributed to it.
/// </summary>
sealed class PurposeAgents : IAIAgents
{
    /// <inheritdoc/>
    public AgentDescriptor? Find(AgentId id) => new(id, id.Value);

    /// <inheritdoc/>
    public AgentDescriptor? FindByPurpose(LanguageModelPurpose purpose) => new(AgentId.For(purpose), purpose.Value);
}
```

### 1. Register the backend

`AddCratisAI` registers the package. Call it before `AddCratis`, so Chronicle's type discovery
sees the package's events, projections and commands (see [Abstractions](./abstractions.md) for
why the order matters).

The package needs two things from your application:

- **An `IAIAgents` implementation**, registered with `WithAgents<T>()`. It tells the package
  which agent stands behind each purpose, so every event a chat causes names the agent that
  caused it. `PurposeAgents` is the smallest version: it names one agent per purpose, using
  `AgentId.For(purpose)` as the identity. A real application looks its agents up instead.
- **A Chronicle `IIdentityProvider`**, so events record who caused them. The example registers
  the ASP.NET Core identity provider and the `IHttpContextAccessor` it reads from. Write both type
  names in full: Arc also has an `IIdentityProvider`, and with both namespaces imported the short
  name is ambiguous.

`AddCratis` with `WithMongoDB()` sets up Arc and Chronicle with MongoDB read models, and
`UseCratis()` adds them to the request pipeline. `WithMongoDB` needs the MongoDB server and
database name; the example sets them in code, and you can bind them from configuration instead.
Change the server address if your MongoDB does not run on `localhost:27017`.

### 2. Configure one provider and point the purpose at it

Configuration is recorded as events, through the same commands an administration screen would
send. The `/setup` endpoint runs them through `ICommandPipeline`:

- `AddOpenAIProvider` adds an OpenAI provider named `OpenAI` with the key from `OPENAI_API_KEY`.
  The last argument is the provider's maximum number of concurrent worker sessions; `0` means
  no limit. The command's response is the new provider's `AIProviderId`.
- `SetAIProviderTierModels` maps the provider's `Fast` tier to the `gpt-4.1-mini` model. Start
  from `TierModels.NotSet` and set only the tiers you want to pin.
- `ConfigureAgent` connects the `Greeting` purpose to an agent named `Greeter` that uses the
  `Fast` tier on that provider.

Run setup once. The configuration is stored in Chronicle and survives a restart.

The example maps `/setup` only in the `Development` environment, because it is unauthenticated:
anyone who can reach it could add providers that use your API key and repoint the purpose. In a
real application, send these commands from an administration screen or command endpoint that
requires an administrator, and keep provider configuration out of anonymous or low-privilege
reach.

### 3. Ask for a chat client by purpose and send one message

`IAIChatClients.For(purpose)` returns a standard `Microsoft.Extensions.AI` `IChatClient` for
the provider and model the purpose resolves to. From there you use the ordinary `IChatClient`
API: `GetResponseAsync` sends the message and returns the response.

## Run it

1. Start Chronicle and MongoDB.
2. Set the key and start the application:

   ```shell
   export OPENAI_API_KEY="<your OpenAI API key>"
   dotnet run --environment Development
   ```

3. Configure the provider and the purpose, then ask for a greeting. Use the address `dotnet run`
   prints:

   ```shell
   curl -X POST http://localhost:5000/setup
   curl http://localhost:5000/hello
   ```

The second call prints the model's one-sentence greeting.

## Next steps

- [Architecture](./architecture.md) describes what each part of the package owns.
- [Abstractions](./abstractions.md) covers the seams a consumer implements, including
  `IAIAgents` and `IAgentExecution`.
- [Provider capacity](./provider-capacity.md) explains pools and how they choose a provider.
