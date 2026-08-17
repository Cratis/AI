// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Work.Authorizing.for_WorkAuthorization.when_projecting;

public class and_a_token_is_issued : Specification
{
    static readonly WorkId _workId = WorkId.New();

    ReadModelScenario<WorkAuthorization> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_workId)
            .Events(new WorkTokenIssued("the-issued-token"));

    [Fact]
    void should_hold_the_token() => _scenario.Instance.Token.ShouldEqual(new WorkToken("the-issued-token"));

    [Fact]
    void should_be_keyed_by_the_work() => _scenario.Instance.Id.ShouldEqual(_workId);
}
#endif
