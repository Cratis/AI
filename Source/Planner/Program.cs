// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Globalization;
using Cratis.Arc;
using Cratis.Arc.MongoDB;
using Planner.Hosting;

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

builder.Services.AddHealthChecks();
builder.Services.AddOpenApi();

var app = builder.Build();

app.UseRouting();
app.UseWebSockets();
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapHealthChecks("/health");
app.UseCratis();
app.MapOpenApi();

app.MapFallbackToFile("/index.html");

await app.RunAsync();
