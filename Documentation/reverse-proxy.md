---
title: Serve local models over the OpenAI and Claude protocols
description: Cratis.AI.ReverseProxy is a YARP-based proxy that exposes models running elsewhere over both the OpenAI and Anthropic APIs, routed by model name.
---

`Cratis.AI.ReverseProxy` is a YARP-based reverse proxy for ASP.NET Core applications that exposes models served by other machines (Ollama, LM Studio, vLLM, llama.cpp and similar) over both the OpenAI and the Anthropic (Claude) protocols. A caller points an SDK at the proxy, names a model, and the proxy sends the request to whichever endpoint serves it.

## Add it to an application

```csharp
using Cratis.AI.ReverseProxy;
using Cratis.AI.ReverseProxy.Routing;

builder.Services.AddCratisAIReverseProxy(options => options.PathPrefix = "/ai");
builder.Services.AddSingleton<IModelAccess, MyModelAccess>();

var app = builder.Build();
app.MapCratisAIReverseProxy();
```

The proxy hands requests to a machine somebody owns, so it lets nobody in until you register an `IModelAccess`. `IsCaller` says whether the request may use the proxy at all; `Allows` says whether it may use a given endpoint. `AnonymousModelAccess` exists for a proxy that listens on the local machine only.

Callers then use the protocol their SDK speaks, under the prefix:

| Protocol | Request | Credential header |
|---|---|---|
| OpenAI | `POST /ai/v1/chat/completions` (also `completions`, `embeddings`, `responses`) | `Authorization: Bearer` |
| Anthropic | `POST /ai/v1/messages` | `x-api-key` and `anthropic-version` |
| Both | `GET /ai/v1/models` (shape follows the caller's protocol) | as above |

To skip model routing, pin an endpoint: `/ai/endpoints/{id}/v1/chat/completions`. Any other path, such as an Ollama `/api/pull`, is refused, so the proxy cannot be used to manage the backend.

## Tell it what exists

Endpoints live in `IModelEndpoints` and can change while the proxy runs; routes follow.

```csharp
endpoints.Set(new ModelEndpoint(
    Id: "workstation",
    Name: "Workstation",
    BaseUrl: "http://localhost:11434",
    Protocols: AIProtocol.OpenAI | AIProtocol.Anthropic,
    Models: [new ServedModel("llama3")],
    ApiKey: ""));
```

A request is routed by the `model` in its body, among endpoints that speak the caller's protocol; when two serve the same model, the lowest identity wins. The proxy does not translate between protocols: an Anthropic request needs an endpoint that speaks Anthropic. Ollama and LM Studio answer both on one address.

`ModelDiscovery.Probe` finds what a backend serves (its OpenAI-shaped `/v1/models`, Anthropic's list, or Ollama's `/api/tags`), which is how a settings screen can offer a "detect" button.

## Reach the backend any way you like

How a request reaches an endpoint is an `IModelTransport`. The default, `DirectModelTransport`, calls the backend over HTTP and streams the response so server-sent events arrive as the model produces them. Register your own to carry requests elsewhere, for example through a tunnel to the machine that has the model; the proxy, routing and access checks stay the same.

Whatever the transport, the proxy removes the caller's credential, cookies and forwarded-identity headers before it hands over the request. The backend only ever sees the endpoint's own key, in the form its protocol expects.
