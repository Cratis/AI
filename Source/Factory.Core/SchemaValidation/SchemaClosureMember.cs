// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Hashing;

namespace Cratis.Factory.SchemaValidation;

/// <summary>
/// Describes one top-level schema document in a root's transitive closure.
/// </summary>
/// <param name="SchemaId">The caller logical schema identifier.</param>
/// <param name="ContentHash">The canonical document content hash.</param>
/// <param name="ReferenceCount">The number of reference edges originating in reachable resources contained by the document.</param>
public sealed record SchemaClosureMember(string SchemaId, Sha256Hash ContentHash, int ReferenceCount);
