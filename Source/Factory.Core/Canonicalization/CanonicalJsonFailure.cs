// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Canonicalization;

/// <summary>
/// Describes a canonical JSON rejection using bounded metadata only.
/// </summary>
/// <param name="Code">The stable reason for rejection.</param>
/// <param name="Position">The optional, nonnegative byte position clamped to the input bounds.</param>
/// <param name="Depth">The optional, nonnegative container depth clamped to the configured bound plus one.</param>
public sealed record CanonicalJsonFailure(CanonicalJsonFailureCode Code, int? Position = null, int? Depth = null);
