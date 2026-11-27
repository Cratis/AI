// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#region docs:host
var builder = WebApplication.CreateBuilder(args);

builder.AddCratis(
    configureArcBuilder: arcBuilder => arcBuilder.WithMongoDB(configureMongoDB: mongoBuilder => mongoBuilder.WithCamelCaseNamingPolicy()),
    configureChronicleBuilder: chronicleBuilder => chronicleBuilder.WithCamelCaseNamingPolicy());

builder.Services.AddControllers();
builder.Services.AddMvc();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options => options.AddConcepts());

var app = builder.Build();

app.UseRouting();

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseWebSockets();
app.MapControllers();
app.UseCratis();

app.UseSwagger();
app.UseSwaggerUI();
app.MapFallbackToFile("/index.html");

await app.RunAsync();
#endregion docs:host
