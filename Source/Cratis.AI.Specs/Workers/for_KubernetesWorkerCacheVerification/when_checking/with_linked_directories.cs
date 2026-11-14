// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_KubernetesWorkerCacheVerification.when_checking;

public class with_linked_directories : given.cache_directories
{
    [Theory]
    [InlineData(Memory)]
    [InlineData(".agent-memory")]
    [InlineData(Repository)]
    [InlineData("owner")]
    [InlineData("owner/group")]
    void should_refuse_a_linked_leaf_or_ancestor(string relative)
    {
        var path = Path.Combine(_root.FullName, relative);
        var target = path + "-original";
        Directory.Move(path, target);
        Directory.CreateSymbolicLink(path, target);
        try
        {
            Verify(Memory, Repository).ShouldNotEqual(0);
        }
        finally
        {
            Directory.Delete(path);
            Directory.Move(target, path);
        }
    }
}
