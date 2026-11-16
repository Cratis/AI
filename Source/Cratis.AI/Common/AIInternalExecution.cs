// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Arc.Http;
using Cratis.Arc.Tenancy;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Common;

/// <summary>
/// Identifies package-owned command execution independently of the current request principal.
/// </summary>
internal static class AIInternalExecution
{
    static readonly AsyncLocal<Scope?> _current = new();

    /// <summary>
    /// Gets whether package-owned work is active on the current execution flow.
    /// </summary>
    internal static bool IsActive => _current.Value is { IsActive: true };

    /// <summary>
    /// Begins a package-owned execution scope.
    /// </summary>
    /// <param name="systemExecution">The system identity scope provider.</param>
    /// <param name="requests">The current execution flow's request context accessor.</param>
    /// <returns>A scope that restores the preceding execution state when disposed.</returns>
    internal static IDisposable Begin(ISystemExecution systemExecution, IHttpRequestContextAccessor requests)
    {
        var request = requests.Current;

        // Arc caches the tenant on this execution flow; resolve it while the request is available.
        _ = request?.RequestServices.GetService<ITenantIdAccessor>()?.Current;
        requests.Current = null;
        try
        {
            var scope = new Scope(_current.Value, systemExecution.AsSystem(), requests, request);
            _current.Value = scope;
            return scope;
        }
        catch
        {
            requests.Current = request;
            throw;
        }
    }

    sealed class Scope(Scope? previous, IDisposable systemScope, IHttpRequestContextAccessor requests, IHttpRequestContext? request) : IDisposable
    {
        internal bool IsActive { get; private set; } = true;

        public void Dispose()
        {
            if (!IsActive)
            {
                return;
            }

            IsActive = false;
            _current.Value = previous;
            try
            {
                systemScope.Dispose();
            }
            finally
            {
                requests.Current = request;
            }
        }
    }
}
