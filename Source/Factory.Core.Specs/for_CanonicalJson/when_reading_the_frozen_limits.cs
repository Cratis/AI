// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Conformance;

namespace Cratis.Factory.for_CanonicalJson;

public class when_reading_the_frozen_limits : Specification
{
    CanonicalJsonVectorLimits _limits = null!;

    void Because() => _limits = CanonicalJsonVectorManifestLoader.Load().Limits;

    [Fact] void should_limit_input_bytes() => _limits.MaximumInputBytes.ShouldEqual(CanonicalJsonLimits.MaximumInputBytes);
    [Fact] void should_limit_output_bytes() => _limits.MaximumOutputBytes.ShouldEqual(CanonicalJsonLimits.MaximumCanonicalBytes);
    [Fact] void should_limit_nesting_depth() => _limits.MaximumDepth.ShouldEqual(CanonicalJsonLimits.MaximumNestingDepth);
    [Fact] void should_limit_string_scalars() => _limits.MaximumStringScalars.ShouldEqual(CanonicalJsonLimits.MaximumStringScalars);
    [Fact] void should_limit_key_scalars() => _limits.MaximumKeyScalars.ShouldEqual(CanonicalJsonLimits.MaximumStringScalars);
    [Fact] void should_limit_structural_tokens() => _limits.MaximumStructuralPunctuationTokens.ShouldEqual(CanonicalJsonLimits.MaximumStructuralTokens);
    [Fact] void should_limit_array_items() => _limits.MaximumArrayItems.ShouldEqual(CanonicalJsonLimits.MaximumArrayItems);
    [Fact] void should_limit_object_members() => _limits.MaximumObjectMembers.ShouldEqual(CanonicalJsonLimits.MaximumObjectMembers);
}
