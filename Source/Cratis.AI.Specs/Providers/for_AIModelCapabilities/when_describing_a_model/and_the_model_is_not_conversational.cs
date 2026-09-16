// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.for_AIModelCapabilities.when_describing_a_model;

/// <summary>
/// An embedding, transcription or moderation model has no completion surface at all - it must never
/// be offered anywhere a chat completion or a tool-using job is choosing a model.
/// </summary>
public class and_the_model_is_not_conversational : Specification
{
    IReadOnlySet<AIModelCapability> _result;

    void Because() => _result = AIModelCapabilities.For((ModelName)"text-embedding-3-large");

    [Fact] void should_have_no_capabilities() => _result.ShouldBeEmpty();
}
