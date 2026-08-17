// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Conformance;

namespace Cratis.Factory.for_CanonicalJson;

public class when_loading_the_language_neutral_manifest : Specification
{
    CanonicalJsonVectorManifest _manifest = null!;
    CanonicalJsonSelfHashVerification _selfHashVerification = null!;
    Exception _unknownOperationError = null!;
    Exception _unknownModeError = null!;
    Exception _invalidRepeatCountError = null!;

    void Because()
    {
        _manifest = CanonicalJsonVectorManifestLoader.Load();
        var canonicalManifest = CanonicalJson.Parse(File.ReadAllBytes(CanonicalJsonVectorManifestLoader.ManifestPath));
        _selfHashVerification = CanonicalJsonSelfHash.Verify(canonicalManifest, CanonicalJsonSelfHashField.ContentHash);
        var first = _manifest.Cases[0];
        _unknownOperationError = Cratis.Specifications.Catch.Exception(() =>
            CanonicalJsonVectorManifestLoader.Validate(_manifest with { Cases = [first with { Operation = "unknown" }] }));
        _unknownModeError = Cratis.Specifications.Catch.Exception(() =>
            CanonicalJsonVectorManifestLoader.Validate(_manifest with { Cases = [first with { Mode = "verify" }] }));
        _invalidRepeatCountError = Cratis.Specifications.Catch.Exception(() =>
            CanonicalJsonVectorManifestLoader.Validate(_manifest with { Cases = [first with { RepeatCount = 1 }] }));
    }

    [Fact] void should_use_protocol_version_one() => _manifest.ProtocolVersion.ShouldEqual("1");
    [Fact] void should_name_the_factory_algorithm() => _manifest.Algorithm.ShouldEqual("factory-canonical-json-v1");
    [Fact] void should_verify_its_own_top_level_content_hash() => _selfHashVerification.Status.ShouldEqual(CanonicalJsonSelfHashVerificationStatus.Verified);
    [Fact] void should_have_unique_case_ids() => _manifest.Cases.Select(_ => _.Id).Distinct(StringComparer.Ordinal).Count().ShouldEqual(_manifest.Cases.Count);
    [Fact] void should_define_exactly_one_input_source_per_case() => _manifest.Cases.All(_ => (_.InputBase64 is null) != (_.Generator is null)).ShouldBeTrue();
    [Fact] void should_define_expected_canonical_results_for_every_accepted_case() => _manifest.Cases.Where(_ => _.Expected.Accepted).All(_ => _.Expected.CanonicalByteLength.HasValue && _.Expected.CanonicalHash is not null).ShouldBeTrue();
    [Fact] void should_define_an_error_code_for_every_rejected_case() => _manifest.Cases.Where(_ => !_.Expected.Accepted).All(_ => _.Expected.ErrorCode is not null).ShouldBeTrue();
    [Fact] void should_bind_verification_actual_hash_availability() => _manifest.Cases.Where(_ => _.Mode == "verify").All(_ => _.Expected.VerificationStatus == "RootNotObject" ? _.Expected.SelfHash is null : _.Expected.SelfHash is not null).ShouldBeTrue();
    [Fact] void should_bind_verification_declared_hash_availability() => _manifest.Cases.Where(_ => _.Mode == "verify").All(_ => string.Equals(_.Expected.VerificationStatus, "Verified", StringComparison.Ordinal) || string.Equals(_.Expected.VerificationStatus, "Mismatch", StringComparison.Ordinal) ? _.Expected.DeclaredHash is not null : _.Expected.DeclaredHash is null).ShouldBeTrue();
    [Fact] void should_give_equivalent_inputs_identical_expected_results() => _manifest.Cases.Where(_ => _.EquivalenceGroup is not null).GroupBy(_ => _.EquivalenceGroup, StringComparer.Ordinal).All(_ => _.Select(vector => $"{vector.Expected.CanonicalBase64}|{vector.Expected.CanonicalHash}").Distinct(StringComparer.Ordinal).Count() == 1).ShouldBeTrue();
    [Fact] void should_reject_an_unknown_operation() => _unknownOperationError.ShouldBeOfExactType<InvalidDataException>();
    [Fact] void should_reject_an_unknown_mode() => _unknownModeError.ShouldBeOfExactType<InvalidDataException>();
    [Fact] void should_reject_an_invalid_repeat_count() => _invalidRepeatCountError.ShouldBeOfExactType<InvalidDataException>();
}
