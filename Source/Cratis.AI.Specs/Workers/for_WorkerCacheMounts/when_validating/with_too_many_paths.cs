// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_WorkerCacheMounts.when_validating;

public class with_too_many_paths : Specification
{
    [Fact] void should_refuse_the_list() => WorkerCacheMounts.TryCreate(new("v1-" + new string('a', 64), Enumerable.Range(0, 257).Select(index => $"a/{index}.git").ToArray()), out _).ShouldBeFalse();
}
