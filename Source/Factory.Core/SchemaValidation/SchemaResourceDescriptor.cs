// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Hashing;

namespace Cratis.Factory.SchemaValidation;

/// <summary>
/// Describes one top-level or embedded resource in an immutable schema resource set.
/// </summary>
/// <param name="SchemaId">The resolved exact language-neutral resource identifier.</param>
/// <param name="DocumentId">The caller logical identifier of the containing schema document.</param>
/// <param name="ContentHash">The canonical content hash of the containing schema document.</param>
/// <param name="ReferenceCount">The number of reference edges originating within the resource.</param>
public sealed record SchemaResourceDescriptor(string SchemaId, string DocumentId, Sha256Hash ContentHash, int ReferenceCount);
