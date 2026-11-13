// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using NSubstitute;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_launching;

public class with_a_reserved_secret : given.a_launch
{
    Exception _error;
    void Establish()
    {
        _options.RepositoryCacheEnvironmentVariable = "CUSTOM_CACHE";
        _job = _job with { Secrets = new Dictionary<string, string> { ["custom_cache"] = "synthetic-value" } };
    }
    async Task Because() => _error = await Catch.Exception(Start);
    [Fact] void should_explain_the_rejection() => _error.Message.ShouldContain("reserved for worker runtime configuration");
    [Fact] void should_not_contact_the_cluster() => _factory.DidNotReceive().Create();
    [Fact] void should_not_create_a_secret() => _createdSecret.ShouldBeNull();
    [Fact] void should_not_create_a_job() => _createdJob.ShouldBeNull();
}
