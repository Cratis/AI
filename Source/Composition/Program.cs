// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.Aspire;

var builder = DistributedApplication.CreateBuilder(args);

// MongoDB the way Chronicle needs it - a self-initiating single-node replica set exposed through a
// connection string with directConnection=true. Chronicle relies on transactions and change streams,
// which a standalone mongod does not support. The same instance backs the Planner's Arc read models
// and the Orleans clustering tables.
var mongodb = builder.AddCratisChronicleMongoDB();

// Chronicle with external MongoDB - the slim development image, so the kernel and the MongoDB the
// application also uses are the same instance.
var chronicle = builder.AddCratisChronicle(configure: c => c.WithMongoDB(mongodb));

var plannerFrontend = builder
    .AddViteApp("planner-frontend", "../Planner")
    .WithEndpoint("http", endpoint => endpoint.Port = 9100)
    .WithYarn()
    .WithViteConfig(".frontend/vite.config.ts");

builder
    .AddProject<Projects.Planner>("planner")
    .WithEndpoint("http", endpoint => endpoint.Port = 5200)
    .WithEnvironment("Cratis__Chronicle__ConnectionString", ReferenceExpression.Create($"chronicle://{chronicle.Resource.GrpcEndpoint.Property(EndpointProperty.Host)}:{chronicle.Resource.GrpcEndpoint.Property(EndpointProperty.Port)}"))
    .WithEnvironment("Cratis__MongoDB__Server", mongodb.Resource.ConnectionStringExpression)
    .WaitFor(chronicle);

plannerFrontend.WaitFor(chronicle);

await builder.Build().RunAsync();
