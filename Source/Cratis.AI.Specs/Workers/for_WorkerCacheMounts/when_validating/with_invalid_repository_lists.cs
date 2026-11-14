// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_WorkerCacheMounts.when_validating;

public class with_invalid_repository_lists : Specification
{
    [Fact] void should_refuse_a_missing_list() => WorkerCacheMounts.TryCreate(new("v1-" + new string('a', 64), null!), out _).ShouldBeFalse();
}
