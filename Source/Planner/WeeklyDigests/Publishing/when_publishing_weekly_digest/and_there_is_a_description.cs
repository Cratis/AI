// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.Extensions.DependencyInjection;
using ListedWeeklyDigest = Planner.WeeklyDigests.Listing.WeeklyDigest;

namespace Planner.WeeklyDigests.Publishing.when_publishing_weekly_digest;

public class and_there_is_a_description : Specification
{
    static readonly WeeklyDigestId _id = WeeklyDigestId.New();

    IWeeklyDigestPublisher _publisher;
    CommandScenario<PublishWeeklyDigest> _scenario;
    CommandResult _result;

    void Establish()
    {
        _publisher = Substitute.For<IWeeklyDigestPublisher>();
        _publisher.Publish(Arg.Any<WeeklyDigestDescription>(), Arg.Any<IEnumerable<string>>(), Arg.Any<CancellationToken>())
            .Returns(["Discord"]);

        _scenario = new();
        _scenario.Services.AddSingleton(_publisher);
        _scenario.Given.ForEventSource(_id).ReadModel(new ListedWeeklyDigest(
            _id, "Shipped the dashboard.", Description: "Wow, what a week.", Status: WeeklyDigestStatus.Unpublished));
    }

    async Task Because() => _result = await _scenario.Execute(new PublishWeeklyDigest(_id));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_record_where_it_was_published() => _scenario.EventSequence.ShouldHaveAppendedEvent<WeeklyDigestPublished>(
        @event => @event.PublishedTo.Single() == "Discord");
}
#endif
