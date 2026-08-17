// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Work.Completing;

namespace Planner.Work.Authorizing.for_WorkAuthorization.when_projecting;

/// <summary>
/// A callback credential outlives its usefulness the moment the work it belongs to is finished, so
/// the read model is removed by every terminal event rather than keeping the token valid forever.
/// </summary>
public class and_the_work_reaches_a_terminal_state : Specification
{
    static readonly WorkId _workId = WorkId.New();

    ReadModelScenario<WorkAuthorization> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_workId)
            .Events(
                new WorkTokenIssued("the-issued-token"),
                new WorkCompleted("All done", 42, "https://github.com/Cratis/Studio/pull/42", "Cratis", "Studio", 1000, 2000, 1.5m, 60000));

    /// <summary>
    /// The removal leaves nothing to read the token out of. Whether that surfaces as no instance at
    /// all or as a default-initialized one depends on where it is read from, which is why
    /// <see cref="WorkTokens.IsValid"/> treats both as "no valid token" rather than comparing against
    /// a sentinel.
    /// </summary>
    [Fact]
    void should_no_longer_hold_the_token() =>
        string.IsNullOrEmpty(_scenario.Instance?.Token?.Value).ShouldBeTrue();
}
#endif
