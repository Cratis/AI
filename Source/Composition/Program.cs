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
    .WithEnvironment("Cratis__Chronicle__Storage__Type", "MongoDB")
    .WithEnvironment(context => context.EnvironmentVariables["Cratis__Chronicle__Storage__ConnectionDetails"] = mongodb.Resource.ConnectionStringExpression);

// Chronicle takes a while to come up (patches, authentication setup). The client does not fully
// recover a command pipeline that raced a failed first connection, so gate the Planner on the
// kernel actually answering - any HTTP response over TLS on the single Chronicle port will do.
var chronicleReady = builder
    .AddContainer("chronicle-ready", "curlimages/curl", "8.10.1")
    .WithArgs("sh", "-c", "until curl -ks https://chronicle:35000/ -o /dev/null; do sleep 1; done")
    .WaitFor(chronicle);

var plannerFrontend = builder
    .AddViteApp("planner-frontend", "../Planner")
    .WithEndpoint("http", endpoint => endpoint.Port = 9100)
    .WithYarn()
    .WithViteConfig(".frontend/vite.config.ts");

builder
    .AddProject<Projects.Planner>("planner")
    .WithEndpoint("http", endpoint => endpoint.Port = 5200)
    .WithEnvironment("Cratis__Chronicle__ConnectionString", "chronicle://chronicle-dev-client:chronicle-dev-secret@localhost:35000")
    .WithEnvironment("Cratis__MongoDB__Server", mongodb.Resource.ConnectionStringExpression)
    .WaitFor(chronicle)
    .WaitForCompletion(chronicleReady);

plannerFrontend.WaitFor(chronicle);

await builder.Build().RunAsync();
