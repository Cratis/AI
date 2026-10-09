// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers;

/// <summary>
/// The shared failure result and its credential-free structured logging details.
/// </summary>
/// <param name="Result">The failure returned to the caller.</param>
/// <param name="Model">The model asked for, redacted if it resembles a credential.</param>
/// <param name="Body">The bounded, redacted vendor response body.</param>
/// <param name="ErrorType">The vendor's error type, when provided.</param>
/// <param name="ErrorCode">The vendor's error code, when provided.</param>
/// <param name="RetryAfter">The raw, redacted Retry-After header, when provided.</param>
internal record VendorFailure(LanguageModelResult Result, string Model, string Body, string? ErrorType, string? ErrorCode, string? RetryAfter);
