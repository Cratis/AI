// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Globalization;
using Cratis.Arc;
using Cratis.Arc.MongoDB;
using Planner.Alerts;
using Planner.Alerts.Webhooks;
using Planner.GitHub;
using Planner.GitHub.App;
using Planner.GitHub.Synchronization;
using Planner.GitHub.Webhooks;
using Planner.Hosting;
using Planner.LanguageModels;
using Planner.Operations;
using Planner.Work.Callback;
using Planner.Work.Scheduling;
using Planner.Work.Workers;

// Force invariant culture for the backend.
CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
CultureInfo.DefaultThreadCurrentUICulture = CultureInfo.InvariantCulture;
CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
CultureInfo.CurrentUICulture = CultureInfo.InvariantCulture;

var builder = WebApplication.CreateBuilder(args);

builder.AddCratis(
    options =>
    {
        options.GeneratedApis.RoutePrefix = "api";
        options.GeneratedApis.IncludeCommandNameInRoute = false;
        options.GeneratedApis.SegmentsToSkipForRoute = 1;
    },
    configureArcBuilder: arcBuilder =>
        arcBuilder.WithMongoDB(configureMongoDB: mongoDBBuilder => mongoDBBuilder.WithCamelCaseNamingPolicy(pluralizeReadModels: true)),
    configureChronicleOptions: options =>
    {
        options.EventStore = "Planner";
        options.ProgramIdentifier = "Cratis Planner";

        // Give the initial Chronicle handshake headroom under Aspire-orchestrated startup where
        // several containers/processes compete for CPU at once.
        options.ConnectTimeout = 30;
    },
    configureChronicleBuilder: chronicleBuilder => chronicleBuilder.WithCamelCaseNamingPolicy());

builder.ConfigurePlannerTelemetry();
builder.AddPlannerOrleans();

builder.Services.AddGitHub(builder.Configuration);
builder.Services.AddLanguageModel(builder.Configuration);
builder.Services.AddWorkerRuntime(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton<Planner.Identity.ICurrentUser, Planner.Identity.CurrentUser>();
builder.Services.Configure<SchedulingOptions>(builder.Configuration.GetSection(SchedulingOptions.SectionName));
builder.Services.Configure<WorkerOptions>(builder.Configuration.GetSection(WorkerOptions.SectionName));
builder.Services.Configure<AlertOptions>(builder.Configuration.GetSection(AlertOptions.SectionName));
builder.Services.Configure<OperationsOptions>(builder.Configuration.GetSection(OperationsOptions.SectionName));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IWorkDispatcher, WorkDispatcher>();
builder.Services.AddSingleton<IWorkerEnvironment, WorkerEnvironment>();
builder.Services.AddSingleton<IWorkerCallbackTokens, WorkerCallbackTokens>();
builder.Services.AddSingleton<IIssueSynchronizer, IssueSynchronizer>();
builder.Services.AddSingleton<Planner.Builds.CheckingStatus.IBuildStatusChecker, Planner.Builds.CheckingStatus.BuildStatusChecker>();
builder.Services.AddHostedService<PlannerGrainsActivator>();
builder.Services.AddHealthChecks();
builder.Services.AddOpenApi();

var app = builder.Build();

app.UseRouting();
app.UseWebSockets();
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapHealthChecks("/health");
app.MapWorkerCallbacks();
app.MapGitHubWebhooks();
app.MapGitHubAppEndpoints();
app.MapGitHubSynchronizationEndpoints();
app.MapAlertWebhooks();
app.UseCratis();
app.MapOpenApi();

app.MapFallbackToFile("/index.html");

await app.RunAsync();
