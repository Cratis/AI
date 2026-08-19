// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Arc.AspNetCore.Http;
using Cratis.Arc.Http;
using Planner.Repositories.Adding;

namespace Planner.Identity.for_VerifiedCallerPrincipal.when_establishing_a_verified_caller;

/// <summary>
/// Proves the mechanism every webhook/worker-callback boundary relies on, end to end: establishing a
/// verified caller on the in-flight HTTP request is what lets a command that carries no
/// <see cref="Cratis.Arc.Authorization.AuthorizeAttribute"/> of its own - which
/// <see cref="DenyByDefaultAuthorization"/> now refuses by default - go on to succeed. This is the
/// same call a boundary endpoint makes immediately after its own credential check passes - see
/// <c>AlertWebhookEndpoints</c>, <c>GitHubWebhookEndpoints</c>, <c>WorkerCallbackEndpoints</c>.
/// </summary>
public class and_a_command_is_executed_afterwards : Specification
{
    HttpContext _httpContext;
    CommandScenario<AddRepository> _scenario;
    CommandResult _result;

    void Establish()
    {
        _httpContext = new DefaultHttpContext();
        _scenario = new();
    }

    // Establishing the verified caller and executing the command happen together here - the request
    // context accessor's storage is AsyncLocal, and Cratis.Specifications does not reliably carry an
    // AsyncLocal flow from Establish into Because (see the other specs in this folder).
    async Task Because()
    {
        _httpContext.EstablishAsVerified();

        var requestContextAccessor = new HttpRequestContextAccessor { Current = new AspNetCoreHttpRequestContext(_httpContext) };
        _scenario.Services.AddSingleton<IHttpRequestContextAccessor>(requestContextAccessor);

        _result = await _scenario.Execute(new AddRepository("cratis", "planner"));
    }

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
}
#endif
