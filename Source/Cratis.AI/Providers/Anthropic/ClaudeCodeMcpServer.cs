// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// Exposes caller-scoped functions to one CLI invocation through authenticated loopback HTTP.
/// Disposal cancels and drains every request before releasing the caller's scope.
/// </summary>
public sealed class ClaudeCodeMcpServer : IAsyncDisposable
{
    const int MaxRequestBytes = 1024 * 1024;
    const int MaxConcurrentRequests = 8;
    static readonly string[] _protocolVersions = ["2025-03-26", "2025-06-18"];
    readonly HttpListener _listener = new();
    readonly IReadOnlyDictionary<string, AIFunction> _functions;
    readonly CancellationTokenSource _shutdown = new();
    readonly CancellationTokenSource _linked;
    readonly List<Task> _requests = [];
    readonly Lock _disposalLock = new();
    readonly byte[] _authorizationHash;
    Task? _acceptLoop;
    Task? _disposal;

    /// <summary>
    /// Initializes a per-invocation server. Listening begins only with Start.
    /// </summary>
    /// <param name="functions">Caller-owned functions.</param>
    /// <param name="serverName">MCP server name.</param>
    /// <param name="cancellationToken">Conversation cancellation.</param>
    public ClaudeCodeMcpServer(IEnumerable<AIFunction> functions, string serverName = "cratis", CancellationToken cancellationToken = default)
    {
        ServerName = serverName;
        _functions = functions.ToDictionary(function => function.Name);
        _linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, _shutdown.Token);
        Authorization = $"Bearer {Convert.ToHexString(RandomNumberGenerator.GetBytes(32))}";
        _authorizationHash = SHA256.HashData(Encoding.UTF8.GetBytes(Authorization));
        Endpoint = new Uri($"http://127.0.0.1:{ReserveLoopbackPort()}/mcp/");
        _listener.Prefixes.Add(Endpoint.ToString());
    }

    /// <summary>
    /// Gets the registered name.
    /// </summary>
    public string ServerName { get; }

    /// <summary>
    /// Gets the loopback endpoint.
    /// </summary>
    public Uri Endpoint { get; private set; }

    /// <summary>
    /// Gets the invocation credential written only to its owner-only config file.
    /// </summary>
    internal string Authorization { get; }

    /// <summary>
    /// Gets the per-turn boundary notification, called immediately before attempting a caller function.
    /// </summary>
    internal Action? InvocationStarting { get; init; }

    /// <summary>
    /// Starts accepting bounded authenticated requests.
    /// </summary>
    public void Start()
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                _listener.Start();
                break;
            }
            catch (HttpListenerException) when (attempt < 5)
            {
                _listener.Prefixes.Clear();
                Endpoint = new Uri($"http://127.0.0.1:{ReserveLoopbackPort()}/mcp/");
                _listener.Prefixes.Add(Endpoint.ToString());
            }
        }

        _acceptLoop = AcceptLoop();
    }

    /// <inheritdoc/>
    public ValueTask DisposeAsync()
    {
        lock (_disposalLock)
        {
            return new(_disposal ??= Drain());
        }
    }

    static int ReserveLoopbackPort()
    {
        using var probe = new TcpListener(IPAddress.Loopback, 0);
        probe.Start();
        return ((IPEndPoint)probe.LocalEndpoint).Port;
    }

    static object ToolFailure() => new { content = new[] { new { type = "text", text = "The tool could not complete the request." } }, isError = true };

    static void Close(HttpListenerContext context, HttpStatusCode? status = null)
    {
        try
        {
            if (status is not null) context.Response.StatusCode = (int)status;
            context.Response.Close();
        }
        catch (Exception exception) when (exception is HttpListenerException or IOException or ObjectDisposedException)
        {
            // A disconnected or stopped response has no recipient; the request is still drained.
        }
    }

    async Task Drain()
    {
        var cancellationFailed = false;
        try
        {
            try
            {
                await _shutdown.CancelAsync();
            }
            catch (Exception)
            {
                // Caller-owned cancellation callbacks must not prevent scope draining.
                cancellationFailed = true;
            }

            _listener.Close();
            if (_acceptLoop is not null) await _acceptLoop.ConfigureAwait(false);
            await Task.WhenAll(_requests).ConfigureAwait(false);
        }
        finally
        {
            _linked.Dispose();
            _shutdown.Dispose();
        }

        if (cancellationFailed) throw new ClaudeCodeConversationFailed("A tool cancellation callback failed during shutdown.");
    }

    async Task AcceptLoop()
    {
        while (!_shutdown.IsCancellationRequested)
        {
            HttpListenerContext context;
            try
            {
                context = await _listener.GetContextAsync();
            }
            catch (Exception) when (_shutdown.IsCancellationRequested)
            {
                return;
            }

            // Authenticate before reading the body or allocating a request slot. Browser origins
            // are never allowed, even if they somehow obtain an invocation's bearer credential.
            var authorization = context.Request.Headers["Authorization"] ?? string.Empty;
            if (context.Request.Headers["Origin"] is not null ||
                !CryptographicOperations.FixedTimeEquals(_authorizationHash, SHA256.HashData(Encoding.UTF8.GetBytes(authorization))))
            {
                Close(context, HttpStatusCode.Unauthorized);
                continue;
            }

            _requests.RemoveAll(task => task.IsCompleted);
            if (_requests.Count >= MaxConcurrentRequests)
            {
                Close(context, HttpStatusCode.TooManyRequests);
                continue;
            }

            _requests.Add(HandleRequest(context));
        }
    }

    async Task HandleRequest(HttpListenerContext context)
    {
        try
        {
            if (context.Request.HttpMethod != "POST")
            {
                Close(context, HttpStatusCode.MethodNotAllowed);
                return;
            }

            var protocol = context.Request.Headers["MCP-Protocol-Version"];
            if (context.Request.Url?.AbsolutePath != Endpoint.AbsolutePath ||
                (protocol is not null && !_protocolVersions.Contains(protocol, StringComparer.Ordinal)))
            {
                Close(context, HttpStatusCode.BadRequest);
                return;
            }

            if (context.Request.ContentType?.Split(';')[0].Trim() != "application/json")
            {
                Close(context, HttpStatusCode.UnsupportedMediaType);
                return;
            }

            if (context.Request.ContentLength64 > MaxRequestBytes)
            {
                Close(context, HttpStatusCode.RequestEntityTooLarge);
                return;
            }

            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(_linked.Token);
            deadline.CancelAfter(TimeSpan.FromSeconds(30));
            await using var body = new MemoryStream();
            var buffer = new byte[8192];
            int read;
            while ((read = await context.Request.InputStream.ReadAsync(buffer, deadline.Token)) > 0)
            {
                if (body.Length + read > MaxRequestBytes)
                {
                    Close(context, HttpStatusCode.RequestEntityTooLarge);
                    return;
                }

                await body.WriteAsync(buffer.AsMemory(0, read), deadline.Token);
            }

            using var document = JsonDocument.Parse(body.ToArray());
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object ||
                !root.TryGetProperty("jsonrpc", out var version) || version.ValueKind != JsonValueKind.String || version.GetString() != "2.0" ||
                !root.TryGetProperty("method", out var method) || method.ValueKind != JsonValueKind.String ||
                (root.TryGetProperty("params", out var parameters) && parameters.ValueKind != JsonValueKind.Object))
            {
                Close(context, HttpStatusCode.BadRequest);
                return;
            }

            if (!root.TryGetProperty("id", out var id))
            {
                Close(context, method.GetString() == "notifications/initialized" ? HttpStatusCode.Accepted : HttpStatusCode.BadRequest);
                return;
            }

            if (id.ValueKind is not (JsonValueKind.String or JsonValueKind.Number))
            {
                Close(context, HttpStatusCode.BadRequest);
                return;
            }

            var result = await Dispatch(method.GetString(), root);
            object envelope = result is RpcError error
                ? new { jsonrpc = "2.0", id, error = new { code = error.Code, message = error.Message } }
                : new { jsonrpc = "2.0", id, result };
            var bytes = JsonSerializer.SerializeToUtf8Bytes(envelope);
            context.Response.ContentType = "application/json";
            context.Response.ContentLength64 = bytes.Length;
            await context.Response.OutputStream.WriteAsync(bytes, _linked.Token);
        }
        catch (JsonException)
        {
            Close(context, HttpStatusCode.BadRequest);
        }
        catch (Exception)
        {
            // Neither tool exceptions nor transport diagnostics cross the tenant boundary.
            Close(context, HttpStatusCode.InternalServerError);
        }
        finally
        {
            Close(context);
        }
    }

    Task<object> Dispatch(string? method, JsonElement request) => method switch
    {
        "initialize" => Task.FromResult(Initialize(request)),
        "ping" => Task.FromResult<object>(new { }),
        "tools/list" => Task.FromResult<object>(new
        {
            tools = _functions.Values.Select(function => new { name = function.Name, description = function.Description, inputSchema = function.JsonSchema }),
        }),
        "tools/call" => CallTool(request),
        _ => Task.FromResult<object>(new RpcError(-32601, "Method not found.")),
    };

    object Initialize(JsonElement request)
    {
        if (!request.TryGetProperty("params", out var parameters) ||
            !parameters.TryGetProperty("protocolVersion", out var version) || version.ValueKind != JsonValueKind.String ||
            !parameters.TryGetProperty("capabilities", out var capabilities) || capabilities.ValueKind != JsonValueKind.Object ||
            !parameters.TryGetProperty("clientInfo", out var client) || client.ValueKind != JsonValueKind.Object ||
            !client.TryGetProperty("name", out var name) || name.ValueKind != JsonValueKind.String ||
            !client.TryGetProperty("version", out var clientVersion) || clientVersion.ValueKind != JsonValueKind.String)
        {
            return new RpcError(-32602, "Invalid initialization parameters.");
        }

        // MCP negotiates an unsupported requested version by returning one we implement.
        var protocolVersion = _protocolVersions.Contains(version.GetString(), StringComparer.Ordinal) ? version.GetString() : "2025-06-18";
        return new Dictionary<string, object?>
        {
            ["protocolVersion"] = protocolVersion,
            ["capabilities"] = new { tools = new { } },
            ["serverInfo"] = new { name = ServerName, version = "1.0.0" },
        };
    }

    async Task<object> CallTool(JsonElement request)
    {
        if (!request.TryGetProperty("params", out var parameters) ||
            !parameters.TryGetProperty("name", out var name) || name.ValueKind != JsonValueKind.String ||
            !_functions.TryGetValue(name.GetString()!, out var function))
        {
            return new RpcError(-32602, "Invalid tool name or parameters.");
        }

        var arguments = new AIFunctionArguments();
        if (parameters.TryGetProperty("arguments", out var supplied))
        {
            if (supplied.ValueKind != JsonValueKind.Object || !ClaudeCodeToolArguments.IsValid(supplied, function.JsonSchema))
            {
                return new RpcError(-32602, "Invalid tool arguments.");
            }

            foreach (var property in supplied.EnumerateObject()) arguments.Add(property.Name, property.Value);
        }
        else if (function.JsonSchema.TryGetProperty("required", out var required) && required.GetArrayLength() > 0)
        {
            return new RpcError(-32602, "Missing tool arguments.");
        }

        try
        {
            InvocationStarting?.Invoke();
            var result = await function.InvokeAsync(arguments, _linked.Token);
            if (result is Exception) return ToolFailure();
            var text = result switch
            {
                null => string.Empty,
                string asText => asText,
                JsonElement { ValueKind: JsonValueKind.String } element => element.GetString() ?? string.Empty,
                JsonElement element => element.GetRawText(),
                _ => JsonSerializer.Serialize(result, function.JsonSerializerOptions),
            };
            return new { content = new[] { new { type = "text", text } }, isError = false };
        }
        catch (Exception)
        {
            return ToolFailure();
        }
    }

    sealed record RpcError(int Code, string Message);
}
