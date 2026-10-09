// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using NSubstitute;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_launching;

public class with_oversized_configuration : given.a_launch
{
    void Establish() => _job = _job with { ConfigurationFiles = new Dictionary<string, string> { ["request.json"] = new('é', 520000) } };
    async Task Because() => _outcome = await Start();
    [Fact] void should_refuse_the_configuration_by_utf8_bytes() => _outcome.ShouldEqual(WorkerLaunchOutcome.ConfigurationTooLarge);
    [Fact] void should_not_contact_the_cluster() => _factory.DidNotReceive().Create();
    [Fact] void should_not_create_a_secret() => _createdSecret.ShouldBeNull();
    [Fact] void should_not_create_a_job() => _createdJob.ShouldBeNull();
}
