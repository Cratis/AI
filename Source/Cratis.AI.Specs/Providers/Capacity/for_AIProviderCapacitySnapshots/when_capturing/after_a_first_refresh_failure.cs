// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacitySnapshots.when_capturing;

public class after_a_first_refresh_failure : given.a_snapshot_cache
{
    AIProviderCapacitySnapshot _snapshot;
    async Task Establish() => await _observations.Observe(_provider, _ => throw new HttpRequestException("private-api-key vendor body"));
    void Because() => _snapshot = _snapshots.Capture(_provider);
    [Fact] void should_be_unavailable() => _snapshot.State.ShouldEqual(AIProviderCapacitySnapshotState.Unavailable);
    [Fact] void should_have_no_allowance() => _snapshot.Windows.ShouldBeEmpty();
    [Fact] void should_not_persist_exception_or_vendor_details() => JsonSerializer.Serialize(_snapshot).Contains("private-api-key", StringComparison.Ordinal).ShouldBeFalse();
}
