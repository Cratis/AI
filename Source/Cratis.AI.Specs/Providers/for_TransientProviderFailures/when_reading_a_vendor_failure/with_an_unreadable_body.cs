// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

public class with_an_unreadable_body : given.a_vendor_response
{
    Exception? _error;

    void Establish()
    {
        var stream = Substitute.For<Stream>();
        stream.CanRead.Returns(true);
        stream.ReadAsync(Arg.Any<Memory<byte>>(), Arg.Any<CancellationToken>()).Returns(_ => ValueTask.FromException<int>(new IOException("unreadable")));
        _response.Content = new StreamContent(stream);
    }

    async Task Because() => _error = await Catch.Exception(async () => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.Anthropic, "claude-sonnet-4", _providerId));

    [Fact] void should_not_throw() => _error.ShouldBeNull();
    [Fact] void should_report_the_body_as_unavailable() => _failure.Body.ShouldEqual("unavailable");
    [Fact] void should_preserve_the_status_failure() => _failure.Result.FailureReason.ShouldContain("Anthropic model claude-sonnet-4 returned 429");
    [Fact] void should_still_be_transient() => _failure.Result.IsTransient.ShouldBeTrue();
}
