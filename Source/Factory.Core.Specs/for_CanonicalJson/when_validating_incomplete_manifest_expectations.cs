// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Conformance;

namespace Cratis.Factory.for_CanonicalJson;

public class when_validating_incomplete_manifest_expectations : Specification
{
    Exception _canonicalBytesError = null!;
    Exception _canonicalLengthError = null!;
    Exception _canonicalHashError = null!;
    Exception _byteHashError = null!;
    Exception _calculationResultError = null!;
    Exception _verificationStatusError = null!;
    Exception _verificationDeclaredHashError = null!;
    Exception _missingVerificationDeclaredHashError = null!;
    Exception _rootVerificationDeclaredHashError = null!;
    Exception _rejectionCodeError = null!;
    Exception _flaggedPositionError = null!;
    Exception _flaggedDepthError = null!;

    void Because()
    {
        var manifest = CanonicalJsonVectorManifestLoader.Load();
        var canonical = Case(manifest, "atomic-null");
        var byteHash = Case(manifest, "raw-byte-hash-is-not-canonical-content-hash");
        var calculation = Case(manifest, "content-hash-calculation-omits-only-top-level-field");
        var verification = Case(manifest, "content-hash-verification-valid");
        var missingVerification = Case(manifest, "content-hash-verification-missing");
        var rootVerification = Case(manifest, "content-hash-verification-root-non-object");
        var rejection = Case(manifest, "fraction-is-unsupported");
        var positioned = Case(manifest, "malformed-multiline-reports-absolute-byte-position-and-depth");

        _canonicalBytesError = Validate(manifest, canonical with { Expected = canonical.Expected with { CanonicalBase64 = null } });
        _canonicalLengthError = Validate(manifest, canonical with { Expected = canonical.Expected with { CanonicalByteLength = null } });
        _canonicalHashError = Validate(manifest, canonical with { Expected = canonical.Expected with { CanonicalHash = null } });
        _byteHashError = Validate(manifest, byteHash with { Expected = byteHash.Expected with { ByteHash = null } });
        _calculationResultError = Validate(manifest, calculation with { Expected = calculation.Expected with { SelfHash = null } });
        _verificationStatusError = Validate(manifest, verification with { Expected = verification.Expected with { VerificationStatus = null } });
        _verificationDeclaredHashError = Validate(manifest, verification with { Expected = verification.Expected with { DeclaredHash = null } });
        _missingVerificationDeclaredHashError = Validate(manifest, missingVerification with { Expected = missingVerification.Expected with { DeclaredHash = missingVerification.Expected.SelfHash } });
        _rootVerificationDeclaredHashError = Validate(manifest, rootVerification with { Expected = rootVerification.Expected with { DeclaredHash = "sha256:0000000000000000000000000000000000000000000000000000000000000000" } });
        _rejectionCodeError = Validate(manifest, rejection with { Expected = rejection.Expected with { ErrorCode = null } });
        _flaggedPositionError = Validate(manifest, positioned with { Expected = positioned.Expected with { Position = null } });
        _flaggedDepthError = Validate(manifest, positioned with { Expected = positioned.Expected with { Depth = null } });
    }

    [Fact] void should_require_canonical_bytes_for_an_inline_accepted_case() => _canonicalBytesError.ShouldBeOfExactType<InvalidDataException>();
    [Fact] void should_require_canonical_length_for_an_accepted_case() => _canonicalLengthError.ShouldBeOfExactType<InvalidDataException>();
    [Fact] void should_require_canonical_hash_for_an_accepted_case() => _canonicalHashError.ShouldBeOfExactType<InvalidDataException>();
    [Fact] void should_require_a_raw_hash_for_an_accepted_byte_hash_operation() => _byteHashError.ShouldBeOfExactType<InvalidDataException>();
    [Fact] void should_require_a_result_for_an_accepted_self_hash_calculation() => _calculationResultError.ShouldBeOfExactType<InvalidDataException>();
    [Fact] void should_require_a_status_for_an_accepted_self_hash_verification() => _verificationStatusError.ShouldBeOfExactType<InvalidDataException>();
    [Fact] void should_require_a_declared_hash_for_verified_status() => _verificationDeclaredHashError.ShouldBeOfExactType<InvalidDataException>();
    [Fact] void should_reject_a_declared_hash_for_missing_status() => _missingVerificationDeclaredHashError.ShouldBeOfExactType<InvalidDataException>();
    [Fact] void should_reject_a_declared_hash_for_root_not_object_status() => _rootVerificationDeclaredHashError.ShouldBeOfExactType<InvalidDataException>();
    [Fact] void should_require_an_error_code_for_a_rejection() => _rejectionCodeError.ShouldBeOfExactType<InvalidDataException>();
    [Fact] void should_require_position_metadata_when_flagged() => _flaggedPositionError.ShouldBeOfExactType<InvalidDataException>();
    [Fact] void should_require_depth_metadata_when_flagged() => _flaggedDepthError.ShouldBeOfExactType<InvalidDataException>();

    static CanonicalJsonVector Case(CanonicalJsonVectorManifest manifest, string id) => manifest.Cases.Single(_ => string.Equals(_.Id, id, StringComparison.Ordinal));

    static Exception Validate(CanonicalJsonVectorManifest manifest, CanonicalJsonVector vector) =>
        Cratis.Specifications.Catch.Exception(() => CanonicalJsonVectorManifestLoader.Validate(manifest with { Cases = [vector] }));
}
