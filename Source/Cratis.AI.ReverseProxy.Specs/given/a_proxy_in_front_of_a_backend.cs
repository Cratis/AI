// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections.Concurrent;
using System.Text;
using Cratis.AI.ReverseProxy.Endpoints;
using Cratis.AI.ReverseProxy.Protocols;
using Cratis.AI.ReverseProxy.Routing;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.ReverseProxy.given;

/// <summary>
/// A real proxy (Kestrel, YARP) in front of a fake model server that records what it receives, with one endpoint that serves
/// <c>llama3</c> over OpenAI and Anthropic, authenticated with its own key. Callers present <c>caller-secret</c>.
/// </summary>
public class a_proxy_in_front_of_a_backend : Specification
{
    protected const string CallerSecret = "caller-secret";
    protected const string BackendKey = "backend-secret";

    protected WebApplication _backend;
    protected WebApplication _proxy;
    protected HttpClient _client;
    protected ModelEndpoints _endpoints;
    protected ConcurrentQueue<Received> _received;

    protected record Received(string Method, string Path, string Body, IDictionary<string, string> Headers);

    protected string BackendAddress => _backend.Urls.First();

    void Establish()
    {
        _received = new();
        _backend = Start(app =>
        {
            app.MapGet("/v1/models", () => Results.Json(new { @object = "list", data = new[] { new { id = "llama3", @object = "model" } } }));
            app.MapPost("/v1/chat/completions", async context =>
            {
                await Record(context);
                if (context.Request.Headers.ContainsKey("x-stream"))
                {
                    context.Response.ContentType = "text/event-stream";
                    foreach (var chunk in new[] { "data: one\n\n", "data: two\n\n", "data: [DONE]\n\n" })
                    {
                        await context.Response.WriteAsync(chunk);
                        await context.Response.Body.FlushAsync();
                    }

                    return;
                }

                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync("""{"choices":[{"message":{"role":"assistant","content":"hello from the backend"}}]}""");
            });
            app.MapPost("/v1/messages", async context =>
            {
                await Record(context);
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync("""{"type":"message","role":"assistant","content":[{"type":"text","text":"hello from the backend"}]}""");
            });
            app.MapPost("/api/pull", async context =>
            {
                await Record(context);
                await context.Response.WriteAsync("pulled");
            });
        });

        _endpoints = new ModelEndpoints();
        _endpoints.Set(new("workstation", "Workstation", BackendAddress, AIProtocol.OpenAI | AIProtocol.Anthropic, [new("llama3", "Llama 3")], BackendKey));

        _proxy = Start(
            app => app.MapCratisAIReverseProxy(),
            services =>
            {
                services.AddSingleton<IModelEndpoints>(_endpoints);
                services.AddCratisAIReverseProxy();
                services.AddSingleton<IModelAccess, CallerSecretAccess>();
            });
        _client = new HttpClient { BaseAddress = new Uri(_proxy.Urls.First()), Timeout = TimeSpan.FromSeconds(30) };
    }

    void Destroy()
    {
        _client?.Dispose();
        _proxy?.StopAsync().GetAwaiter().GetResult();
        _backend?.StopAsync().GetAwaiter().GetResult();
    }

    protected static System.Text.Json.JsonElement Parse(string json)
    {
        using var document = System.Text.Json.JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }

    protected static StringContent Json(string json) => new(json, Encoding.UTF8, "application/json");

    protected HttpRequestMessage Post(string path, string json, bool withCredential = true, params (string Name, string Value)[] headers)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, path) { Content = Json(json) };
        if (withCredential)
        {
            request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {CallerSecret}");
        }

        foreach (var (name, value) in headers)
        {
            request.Headers.TryAddWithoutValidation(name, value);
        }

        return request;
    }

    static WebApplication Start(Action<WebApplication> map, Action<IServiceCollection>? services = null)
    {
        var builder = WebApplication.CreateBuilder();
        builder.Logging.ClearProviders();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        services?.Invoke(builder.Services);
        var app = builder.Build();
        map(app);
        app.StartAsync().GetAwaiter().GetResult();
        return app;
    }

    async Task Record(HttpContext context)
    {
        using var reader = new StreamReader(context.Request.Body);
        var body = await reader.ReadToEndAsync();
        _received.Enqueue(new(context.Request.Method, context.Request.Path, body, context.Request.Headers.ToDictionary(header => header.Key, header => header.Value.ToString(), StringComparer.OrdinalIgnoreCase)));
    }

    sealed class CallerSecretAccess : IModelAccess
    {
        public ValueTask<bool> IsCaller(HttpContext context) => ValueTask.FromResult(AIProtocols.PresentedCredential(context.Request) == CallerSecret);

        public ValueTask<bool> Allows(HttpContext context, ModelEndpoint endpoint) => ValueTask.FromResult(true);
    }
}
