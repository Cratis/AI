// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_WorkerCacheMounts.when_validating;

public class without_a_git_suffix : Specification
{
    [Fact] void should_refuse_the_path() => WorkerCacheMounts.TryCreate(new("v1-" + new string('a', 64), ["a/b"]), out _).ShouldBeFalse();
}
