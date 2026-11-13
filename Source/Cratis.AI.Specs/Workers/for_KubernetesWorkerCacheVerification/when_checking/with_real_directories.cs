// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_KubernetesWorkerCacheVerification.when_checking;

public class with_real_directories : given.cache_directories
{
    int _exit;
    void Because() => _exit = Verify(Memory, Repository);
    [Fact] void should_allow_the_worker_to_start() => _exit.ShouldEqual(0);
}
