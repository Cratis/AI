// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Abstractions;

/// <summary>
/// One thing a session's usage is attributed to - a product-defined kind (Direct: <c>"Issue"</c>,
/// Studio: <c>"Project"</c>) plus the identifier of that thing in the product's own domain.
/// </summary>
/// <param name="Kind">The product-defined kind of subject.</param>
/// <param name="Id">The subject's identifier in the product's own domain.</param>
public record UsageSubject(string Kind, string Id);
