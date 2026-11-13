// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_WorkerCacheMounts.when_validating;

public class with_a_missing_memory_key : Specification
{
    [Fact] void should_refuse_a_null_key() => WorkerCacheMounts.TryCreate(new(null!, []), out _).ShouldBeFalse();
    [Fact] void should_refuse_an_empty_key() => WorkerCacheMounts.TryCreate(new(string.Empty, []), out _).ShouldBeFalse();
}
