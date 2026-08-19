// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.Extensions.DependencyInjection;
using ListedWeeklyDigest = Planner.WeeklyDigests.Listing.WeeklyDigest;

namespace Planner.WeeklyDigests.Publishing.when_publishing_weekly_digest;

public class and_there_is_no_description : Specification
{
    static readonly WeeklyDigestId _id = WeeklyDigestId.New();

    IWeeklyDigestPublisher _publisher;
    CommandScenario<PublishWeeklyDigest> _scenario;
    CommandResult _result;

    void Establish()
    {
        _publisher = Substitute.For<IWeeklyDigestPublisher>();
        _scenario = new();
        _scenario.Services.AddSingleton(_publisher);
        _scenario.Given.ForEventSource(_id).ReadModel(new ListedWeeklyDigest(_id, "Shipped the dashboard."));
    }

    async Task Because() => _result = await _scenario.Execute(new PublishWeeklyDigest(_id));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();

    [Fact]
    async Task should_not_publish_anything() =>
        await _publisher.DidNotReceive().Publish(Arg.Any<WeeklyDigestDescription>(), Arg.Any<IEnumerable<string>>(), Arg.Any<CancellationToken>());
}
#endif
