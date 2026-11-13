// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_WorkerCacheMounts.when_validating;

public class without_cache_access : Specification
{
    [Fact] void should_accept_the_absent_request() => WorkerCacheMounts.TryCreate(null, out _).ShouldBeTrue();
    [Fact] void should_not_request_mounts() => WorkerCacheMounts.Create(null).IsRequested.ShouldBeFalse();
}
