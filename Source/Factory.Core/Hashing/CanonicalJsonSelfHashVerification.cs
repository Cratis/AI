// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Hashing;

/// <summary>
/// Describes a self-hash verification outcome without reflecting document content.
/// </summary>
/// <param name="Status">The verification status.</param>
/// <param name="Expected">The declared identifier when it is present and well formed.</param>
/// <param name="Actual">The calculated identifier when calculation was possible.</param>
public sealed record CanonicalJsonSelfHashVerification(
    CanonicalJsonSelfHashVerificationStatus Status,
    Sha256Hash? Expected = null,
    Sha256Hash? Actual = null);
