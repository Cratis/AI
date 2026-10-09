// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

public class with_a_body_that_never_finishes : given.a_vendor_response
{
    TaskCompletionSource<int> _read;

    void Establish()
    {
        _read = new(TaskCreationOptions.RunContinuationsAsynchronously);
        var stream = Substitute.For<Stream>();
        stream.CanRead.Returns(true);

        // This double deliberately ignores cancellation: the diagnostic read has its own deadline.
        stream.ReadAsync(Arg.Any<Memory<byte>>(), Arg.Any<CancellationToken>()).Returns(_ => new ValueTask<int>(_read.Task));
        _response.Content = new StreamContent(stream);
    }

    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.OpenAI, "gpt-4", _providerId).WaitAsync(TimeSpan.FromSeconds(5));

    void Destroy() => _read.TrySetResult(0);

    [Fact] void should_report_the_body_as_unavailable() => _failure.Body.ShouldEqual("unavailable");
}
