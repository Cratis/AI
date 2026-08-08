// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var builder = DistributedApplication.CreateBuilder(args);

// MongoDB the way Chronicle needs it - a self-initiating single-node replica set exposed through a
// connection string with directConnection=true. Chronicle relies on transactions and change streams,
// which a standalone mongod does not support. The same instance backs the Planner's Arc read models
// and the Orleans clustering tables.
var mongodb = builder.AddCratisChronicleMongoDB();

// Chronicle - the slim development image against the MongoDB above. The client connects over TLS on
// the single Chronicle port, so it is exposed as a plain TCP endpoint with a fixed host port; an
// Aspire HTTP endpoint would proxy at the HTTP layer and reset the TLS handshake.
var chronicle = builder
    .AddContainer("chronicle", "cratis/chronicle", "latest-development-slim")
    .WithEndpoint(port: 35000, targetPort: 35000, name: "grpc")
    .WithEndpoint(port: 11111, targetPort: 11111, name: "silo")
    .WithEndpoint(port: 30000, targetPort: 30000, name: "gateway")
    .WithEnvironment("Cratis__Chronicle__Storage__Type", "MongoDB")
    .WithEnvironment(context => context.EnvironmentVariables["Cratis__Chronicle__Storage__ConnectionDetails"] = mongodb.Resource.ConnectionStringExpression);

var plannerFrontend = builder
    .AddViteApp("planner-frontend", "../Planner")
    .WithEndpoint("http", endpoint => endpoint.Port = 9100)
    .WithYarn()
    .WithViteConfig(".frontend/vite.config.ts");

builder
    .AddProject<Projects.Planner>("planner")
    .WithEndpoint("http", endpoint => endpoint.Port = 5200)
    .WithEnvironment("Cratis__Chronicle__ConnectionString", "chronicle://localhost:35000")
    .WithEnvironment("Cratis__MongoDB__Server", mongodb.Resource.ConnectionStringExpression)
    .WaitFor(chronicle);

plannerFrontend.WaitFor(chronicle);

await builder.Build().RunAsync();
