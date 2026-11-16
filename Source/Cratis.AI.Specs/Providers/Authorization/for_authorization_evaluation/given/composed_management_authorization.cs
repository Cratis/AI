// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;
using Cratis.AI.Configuration;
using Cratis.AI.Providers.Adding;
using Cratis.AI.Providers.Reconfiguring;
using Cratis.Arc.Authorization;
using Cratis.Arc.Http;
using Cratis.Types;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Providers.Authorization.for_authorization_evaluation.given;

public class composed_management_authorization : Specification
{
    protected ClaimsPrincipal _principal;
    protected readonly List<bool> _results = [];
    ServiceProvider _services;
    AuthorizationEvaluation _evaluation;
    CurrentPrincipalAccessor _accessor;

    void Establish()
    {
        var services = new ServiceCollection();
        services.AddCratisAI(ai => ai.WithAdministrators<ApplicationAdministrators>());
        _services = services.BuildServiceProvider();
        var requests = Substitute.For<IHttpRequestContextAccessor>();
        requests.Current.Returns((IHttpRequestContext?)null);
        _accessor = new(requests);
        var anonymous = Substitute.For<IInstancesOf<IAnonymousEvaluator>>();
        anonymous.GetEnumerator().Returns(_ => new List<IAnonymousEvaluator> { new AnonymousEvaluator() }.GetEnumerator());
        var attributes = Substitute.For<IInstancesOf<IAuthorizationAttributeEvaluator>>();
        attributes.GetEnumerator().Returns(_ => new List<IAuthorizationAttributeEvaluator> { new AuthorizationAttributeEvaluator() }.GetEnumerator());
        var evaluator = new AuthorizationEvaluator(_accessor, anonymous, attributes);
        var runtime = new ArcAuthorizationPolicyRuntime(_services.GetServices<AuthorizationPolicyRegistration>());
        _evaluation = new(new(anonymous, attributes), evaluator, _accessor, runtime);
    }

    protected async Task Evaluate()
    {
        using var principalScope = _accessor.BeginScope(_principal);
        using var services = _services.CreateScope();
        System.Reflection.MemberInfo[] targets = [typeof(AddOpenAIProvider), typeof(ReconfigureOpenAIProvider), typeof(Listing.AIProvider).GetMethod(nameof(Listing.AIProvider.AllAIProviders))!];
        foreach (var target in targets)
        {
            _results.Add(await _evaluation.IsAuthorized(target, new object(), services.ServiceProvider, CancellationToken.None));
        }
    }

    void Destroy() => _services.Dispose();

    public class ApplicationAdministrators : IAIAdministrators
    {
        public ValueTask<bool> IsAdministrator(ClaimsPrincipal principal, CancellationToken cancellationToken) => ValueTask.FromResult(principal.IsInRole("Administrator"));
    }
}
