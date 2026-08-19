// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Conformance;

namespace Cratis.Factory.for_CanonicalJson;

public class when_using_hostile_generator_records : Specification
{
    const long MaximumRejectionAllocation = 2_000_000;
    IReadOnlyList<HostileOutcome> _outcomes = null!;

    void Because()
    {
        var manifest = CanonicalJsonVectorManifestLoader.Load();
        var repeated = Case(manifest, "representative-string-1024-canonical-bytes");
        var objectMembers = Case(manifest, "object-member-limit-exact");
        var nesting = Case(manifest, "nesting-depth-limit-plus-one");
        var selfHash = Case(manifest, "maximum-self-hash-payload");
        var padded = Case(manifest, "input-byte-limit-plus-one");

        _outcomes =
        [
            Observe(manifest, "overflowing product", repeated with { Generator = new() { Kind = "repeatedString", Scalar = "😀", ScalarCount = int.MaxValue } }),
            Observe(manifest, "oversized UTF-8 product", repeated with { Generator = new() { Kind = "repeatedString", Scalar = "😀", ScalarCount = CanonicalJsonLimits.MaximumStringScalars } }),
            Observe(manifest, "oversized prefix product", objectMembers with { Generator = objectMembers.Generator! with { KeyPrefix = new string('k', 1000) } }),
            Observe(manifest, "unexpected known field", repeated with { Generator = repeated.Generator! with { Count = 1 } }),
            Observe(manifest, "multiple scalar values", repeated with { Generator = repeated.Generator! with { Scalar = "ab" } }),
            Observe(manifest, "mismatched hash field", selfHash with { Generator = selfHash.Generator! with { HashField = "requestHash" } }),
            Observe(manifest, "negative count", repeated with { Generator = repeated.Generator! with { ScalarCount = -1 } }),
            Observe(manifest, "beyond boundary depth", nesting with { Generator = nesting.Generator! with { Depth = CanonicalJsonLimits.MaximumNestingDepth + 2 } }),
            Observe(manifest, "invalid key digits", objectMembers with { Generator = objectMembers.Generator! with { KeyDigits = 11 } }),
            Observe(manifest, "unsafe key prefix", objectMembers with { Generator = objectMembers.Generator! with { KeyPrefix = "\"" } }),
            Observe(manifest, "invalid base64 value", padded with { Generator = padded.Generator! with { ValueBase64 = "!!!!" } }),
            Observe(manifest, "input beyond exact plus one", padded with { Generator = padded.Generator! with { LeadingWhitespaceCount = CanonicalJsonLimits.MaximumInputBytes - 2 } })
        ];
    }

    [Fact] void should_reject_every_record_during_manifest_validation() => _outcomes.All(_ => _.ValidationError?.GetType() == typeof(InvalidDataException)).ShouldBeTrue();
    [Fact] void should_reject_every_record_before_input_generation() => _outcomes.All(_ => _.GenerationError?.GetType() == typeof(InvalidDataException)).ShouldBeTrue();
    [Fact] void should_not_allocate_a_generated_input_before_rejection() => _outcomes.Max(_ => _.GenerationAllocation).ShouldBeLessThan(MaximumRejectionAllocation);

    static CanonicalJsonVector Case(CanonicalJsonVectorManifest manifest, string id) => manifest.Cases.Single(_ => string.Equals(_.Id, id, StringComparison.Ordinal));

    static HostileOutcome Observe(CanonicalJsonVectorManifest manifest, string name, CanonicalJsonVector vector)
    {
        var validationError = Cratis.Specifications.Catch.Exception(() => CanonicalJsonVectorManifestLoader.Validate(manifest with { Cases = [vector] }));
        var before = GC.GetAllocatedBytesForCurrentThread();
        var generationError = Cratis.Specifications.Catch.Exception(() => CanonicalJsonVectorInput.Create(vector));
        var allocation = GC.GetAllocatedBytesForCurrentThread() - before;
        return new(name, validationError, generationError, allocation);
    }

    sealed record HostileOutcome(string Name, Exception ValidationError, Exception GenerationError, long GenerationAllocation);
}
