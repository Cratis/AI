// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Conformance;

sealed class UnknownCanonicalJsonVectorGenerator(string kind) : Exception($"Unknown canonical JSON vector generator kind '{kind}'.");
