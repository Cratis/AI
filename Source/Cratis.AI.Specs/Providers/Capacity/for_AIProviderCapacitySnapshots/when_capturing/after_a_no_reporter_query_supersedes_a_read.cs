// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacitySnapshots.when_capturing;

public class after_a_no_reporter_query_supersedes_a_read : given.a_snapshot_cache
{
    readonly TaskCompletionSource<AIProviderCapacityReport> _pending = new(TaskCreationOptions.RunContinuationsAsynchronously);
    Task<AIProviderCapacity> _oldQuery;
    AIProviderCapacitySnapshot _snapshot;
    void Establish()
    {
        Configure(new(_provider, AIProviderType.Anthropic, new("old-account")));
        _reporter.CanReport(Arg.Any<ConfiguredAIProvider>()).Returns(true);
        _reporter.Report(Arg.Any<ConfiguredAIProvider>(), Arg.Any<CancellationToken>()).Returns(_pending.Task);
        _oldQuery = _capacities.For(_provider);
    }
    async Task Because()
    {
        Configure(new(_provider, AIProviderType.OpenAI, new("new-account")));
        _reporter.CanReport(Arg.Any<ConfiguredAIProvider>()).Returns(false);
        await _capacities.For(_provider);
        _pending.SetResult(AIProviderCapacityReport.Subscription([new(UsageWindowKind.Weekly, "old-account", 0.5, null)]));
        await _oldQuery;
        _snapshot = _snapshots.Capture(_provider);
    }
    [Fact] void should_keep_the_new_accounts_selected_fallback() => _snapshot.Source.ShouldEqual(AIProviderCapacitySource.Unmetered);
    [Fact] void should_not_publish_old_account_windows() => _snapshot.Windows.ShouldBeEmpty();
}
