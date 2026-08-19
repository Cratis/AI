// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Hashing;

namespace Cratis.Factory.SchemaValidation;

/// <summary>
/// Describes one top-level schema document in an immutable resource set.
/// </summary>
/// <param name="SchemaId">The caller logical schema identifier.</param>
/// <param name="ContentHash">The canonical document content hash.</param>
/// <param name="ReferenceCount">The number of reference edges originating in every resource in the document.</param>
public sealed record SchemaDocumentDescriptor(string SchemaId, Sha256Hash ContentHash, int ReferenceCount);
