# Backend quick start: hello chat

This page takes you from an empty ASP.NET Core application to a first chat response from
`Cratis.AI`. It registers the backend, seeds one provider, asks for a chat client by
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
using Cratis.AI.Configuration;
using Cratis.AI.Configuration.Seeding;
using Cratis.AI.Conversations;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.SettingTierModels;
using Cratis.Arc;
using Microsoft.Extensions.AI;

var builder = WebApplication.CreateBuilder(args);

var greeting = new LanguageModelPurpose("Greeting");

// 1. Register the backend. AddCratisAI must come before AddCratis.
// 2. Seed one provider and a purpose.
builder.Services.AddCratisAI(ai => ai.SeedOpenAIProvider(new SeededOpenAIProvider(
    "OpenAI",
    builder.Configuration["OPENAI_API_KEY"],
    [new SeededAgent(greeting, "Greeter", "Answers the hello-chat sample.", ModelTier.Fast)],
    TierModels.NotSet with { Fast = "gpt-4.1-mini" })));
builder.AddCratis(configureArcBuilder: arc => arc.WithMongoDB(mongo =>
{
    mongo.Server = "mongodb://localhost:27017";
    mongo.Database = "HelloChat";
}));

var app = builder.Build();
app.UseCratis();

// 3. Ask for a chat client by purpose and send one message.
app.MapGet("/hello", async (IAIChatClients chatClients) =>
{
    var response = await chatClients.For(greeting).GetResponseAsync("Say hello in one sentence.");
    return response.Text;
});

await app.RunAsync();
```

### 1. Register the backend

`AddCratisAI` registers the package. Call it before `AddCratis`, so Chronicle's type discovery
sees the package's events, projections and commands (see [Abstractions](./abstractions.md) for
why the order matters).

It also registers the two seams a first application would otherwise write itself:

- **An `IAIAgents` lookup**, `PurposeAgents`: one agent per purpose, identified by
  `AgentId.For(purpose)`, so every event a chat causes names the agent that caused it. Replace it
  with `ai.WithAgents<T>()` when your application looks its agents up.
- **A Chronicle `IIdentityProvider`**, the ASP.NET Core one, so events record who caused them. It
  is registered only when you have not registered one, so your own wins.

`AddCratis` with `WithMongoDB()` sets up Arc and Chronicle with MongoDB read models, and
`UseCratis()` adds them to the request pipeline. `WithMongoDB` needs the MongoDB server and
database name; the example sets them in code, and you can bind them from configuration instead.
Change the server address if your MongoDB does not run on `localhost:27017`.

### 2. Seed one provider and a purpose

Configuration is recorded as events, through the same commands an administration screen would
send. `SeedOpenAIProvider` sends them for you at startup:

- It adds an OpenAI provider named `OpenAI` with the key from `OPENAI_API_KEY`. The key comes
  from configuration and is never written to the log. When it is empty, nothing is seeded and a
  warning is logged.
- It maps the provider's `Fast` tier to the `gpt-4.1-mini` model. Start from `TierModels.NotSet`
  and set only the tiers you want to pin.
- It connects the `Greeting` purpose to an agent named `Greeter` that uses the `Fast` tier on that
  provider.

Seeding only creates. When the provider already exists a restart sends nothing, so anything an
administrator changed afterwards with `SetAIProviderTierModels` or `ConfigureAgent` is kept. The
provider is identified by its name, so renaming it in code seeds a second provider. The seed runs a
few seconds after startup and retries while Chronicle and the read models come up, so the first
request can arrive before it has finished.

Seeding runs with the package's own authority and has no endpoint, so only your server code can
trigger it. For production, prefer an administration screen or command endpoint that requires an
administrator, and remove the seed once the provider is administered by hand.

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

3. Ask for a greeting once the seed has run. Use the address `dotnet run` prints:

   ```shell
   curl http://localhost:5000/hello
   ```

The call prints the model's one-sentence greeting.

## Next steps

- [Architecture](./architecture.md) describes what each part of the package owns.
- [Abstractions](./abstractions.md) covers the seams a consumer implements, including
  `IAIAgents` and `IAgentExecution`.
- [Provider capacity](./provider-capacity.md) explains pools and how they choose a provider.
