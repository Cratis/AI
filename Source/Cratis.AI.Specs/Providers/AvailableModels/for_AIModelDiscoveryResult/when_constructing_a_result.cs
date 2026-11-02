// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.AvailableModels.for_AIModelDiscoveryResult;

public class when_constructing_a_result : Specification
{
    [Fact] void should_infer_discovered_for_the_legacy_empty_success() => new AIModelDiscoveryResult([], "").Status.ShouldEqual(AIModelDiscoveryStatus.Discovered);
    [Fact] void should_infer_failed_for_the_legacy_reason() => new AIModelDiscoveryResult([], "fixture failure").Status.ShouldEqual(AIModelDiscoveryStatus.Failed);
    [Fact] void should_keep_the_success_factory() => AIModelDiscoveryResult.Discovered([]).Succeeded.ShouldBeTrue();
    [Fact] void should_keep_the_failure_factory() => AIModelDiscoveryResult.Failed("fixture failure").Succeeded.ShouldBeFalse();
    [Fact] void should_not_count_unavailable_as_success() => AIModelDiscoveryResult.Unavailable("fixture reason").Succeeded.ShouldBeFalse();
    [Fact] void should_not_count_not_attempted_as_success() => new AIModelDiscoveryResult([], "") { Status = AIModelDiscoveryStatus.NotAttempted }.Succeeded.ShouldBeFalse();
}
