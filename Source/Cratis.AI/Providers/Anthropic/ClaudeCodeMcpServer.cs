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
    readonly IReadOnlyDictionary<string, AIFunction> _functions;
    readonly CancellationTokenSource _shutdown = new();
    readonly CancellationTokenSource _linked;
    readonly List<Task> _requests = [];
    readonly Lock _disposalLock = new();
    readonly byte[] _authorizationHash;
    HttpListener? _listener;
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
        Endpoint = ReserveEndpoint();
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
        // .NET's managed HttpListener keeps one process-wide endpoint table, and closing a listener
        // that registered a prefix but never started still binds that port and removes the prefix
        // from whichever listener currently serves it. A listener therefore exists only once it is
        // about to start. A failed start disposes it, so another reserved port needs a new one.
        for (var attempt = 1; ; attempt++)
        {
            var listener = new HttpListener();
            try
            {
                listener.Prefixes.Add(Endpoint.ToString());
                listener.Start();
                _listener = listener;
                break;
            }
            catch (HttpListenerException) when (attempt < 5)
            {
                // The reserved port was taken before the listener bound it; reserve another.
                listener.Close();
                Endpoint = ReserveEndpoint();
            }
            catch
            {
                listener.Close();
                throw;
            }
        }

        _acceptLoop = AcceptLoop(_listener);
    }

    /// <inheritdoc/>
    public ValueTask DisposeAsync()
    {
        lock (_disposalLock)
        {
            return new(_disposal ??= Drain());
        }
    }

    static Uri ReserveEndpoint() => new($"http://127.0.0.1:{ReserveLoopbackPort()}/mcp/");

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

    static bool IsRequestId(JsonElement id) => id.ValueKind is JsonValueKind.String or JsonValueKind.Number;

    static bool IsRpcRequest(JsonElement root, out JsonElement method)
    {
        method = default;
        return root.ValueKind == JsonValueKind.Object &&
            HasRpcVersion(root) &&
            root.TryGetProperty("method", out method) && method.ValueKind == JsonValueKind.String &&
            (!root.TryGetProperty("params", out var parameters) || parameters.ValueKind == JsonValueKind.Object);
    }

    static bool HasRpcVersion(JsonElement root) =>
        root.TryGetProperty("jsonrpc", out var version) && version.ValueKind == JsonValueKind.String && version.GetString() == "2.0";

    static bool HasInitializationParameters(JsonElement request, out JsonElement version)
    {
        version = default;
        return request.TryGetProperty("params", out var parameters) &&
            parameters.TryGetProperty("protocolVersion", out version) && version.ValueKind == JsonValueKind.String &&
            HasObjectProperty(parameters, "capabilities") &&
            parameters.TryGetProperty("clientInfo", out var client) && client.ValueKind == JsonValueKind.Object &&
            HasClientIdentity(client);
    }

    static bool HasObjectProperty(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Object;

    static bool HasClientIdentity(JsonElement client) =>
        client.TryGetProperty("name", out var name) && name.ValueKind == JsonValueKind.String &&
        client.TryGetProperty("version", out var version) && version.ValueKind == JsonValueKind.String;

    static bool HasToolName(JsonElement request, out JsonElement parameters, out JsonElement name)
    {
        name = default;
        return request.TryGetProperty("params", out parameters) &&
            parameters.TryGetProperty("name", out name) && name.ValueKind == JsonValueKind.String;
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

            _listener?.Close();
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

    async Task AcceptLoop(HttpListener listener)
    {
        while (!_shutdown.IsCancellationRequested)
        {
            HttpListenerContext context;
            try
            {
                context = await listener.GetContextAsync();
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
            if (RequestRejection(context.Request) is { } rejection)
            {
                Close(context, rejection);
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
            if (!IsRpcRequest(root, out var method))
            {
                Close(context, HttpStatusCode.BadRequest);
                return;
            }

            if (!root.TryGetProperty("id", out var id))
            {
                Close(context, method.GetString() == "notifications/initialized" ? HttpStatusCode.Accepted : HttpStatusCode.BadRequest);
                return;
            }

            if (!IsRequestId(id))
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

    HttpStatusCode? RequestRejection(HttpListenerRequest request)
    {
        if (request.HttpMethod != "POST") return HttpStatusCode.MethodNotAllowed;

        var protocol = request.Headers["MCP-Protocol-Version"];
        if (request.Url?.AbsolutePath != Endpoint.AbsolutePath ||
            (protocol is not null && !_protocolVersions.Contains(protocol, StringComparer.Ordinal)))
        {
            return HttpStatusCode.BadRequest;
        }

        if (request.ContentType?.Split(';')[0].Trim() != "application/json") return HttpStatusCode.UnsupportedMediaType;
        return request.ContentLength64 > MaxRequestBytes ? HttpStatusCode.RequestEntityTooLarge : null;
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
        if (!HasInitializationParameters(request, out var version))
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
        if (!HasToolName(request, out var parameters, out var name) ||
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

        return await InvokeTool(function, arguments);
    }

    async Task<object> InvokeTool(AIFunction function, AIFunctionArguments arguments)
    {
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
