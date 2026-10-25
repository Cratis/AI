// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;

namespace Cratis.AI.Providers;

/// <summary>
/// Recognizes a vendor failure that says the account's quota, spend limit or credit is used up -
/// as opposed to short-term throttling. Throttling clears within seconds, so retrying the same
/// provider after its <c>Retry-After</c> is right; a spent quota does not clear until the vendor's
/// billing period resets or someone tops it up, so the only useful next step is another provider.
/// </summary>
/// <remarks>
/// Deliberately narrow: an ordinary <c>429 rate_limit_error</c> without one of the codes or messages
/// below is throttling and keeps today's retry. Each entry names where it comes from, so the list
/// can be checked against the vendor rather than trusted.
/// </remarks>
public static class QuotaExhaustion
{
    /// <summary>
    /// Vendor error codes that mean the account, not the request, has run out.
    /// </summary>
    static readonly string[] _codes =
    [

        // Anthropic: a 429 rate_limit_error carrying details.error_code "enforced_spend_limit_reached"
        // when the organization's configured spend limit is enforced - observed in production and
        // pinned by for_TransientProviderFailures/with_an_anthropic_spend_limit (Cratis/AI#346).
        "enforced_spend_limit_reached",

        // OpenAI and Azure OpenAI: a 429 with error.code "insufficient_quota" - "You exceeded your
        // current quota, please check your plan and billing details".
        // https://platform.openai.com/docs/guides/error-codes/api-errors
        "insufficient_quota",

        // OpenAI: error.code "billing_hard_limit_reached" - "Billing hard limit has been reached",
        // returned once an organization's hard monthly budget is spent.
        "billing_hard_limit_reached"
    ];

    /// <summary>
    /// Vendor messages that say the same thing where no code is given.
    /// </summary>
    static readonly string[] _messages =
    [

        // Anthropic: a 400 invalid_request_error "Your credit balance is too low to access the
        // Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."
        // https://docs.anthropic.com/en/api/errors
        "credit balance is too low",

        // OpenAI: the message that accompanies insufficient_quota, for a body whose code was lost.
        "exceeded your current quota"
    ];

    /// <summary>
    /// Whether a vendor's HTTP failure says the provider's quota is used up.
    /// </summary>
    /// <param name="statusCode">The HTTP status the vendor answered with.</param>
    /// <param name="errorCode">The vendor's own error code, when its body carried one.</param>
    /// <param name="text">The vendor's (redacted) response body, or any other text describing the failure.</param>
    /// <returns><see langword="true"/> when the quota is used up.</returns>
    /// <remarks>
    /// <c>402 Payment Required</c> counts on its own: OpenAI-compatible gateways such as OpenRouter
    /// answer 402 when an account or key has insufficient credits
    /// (https://openrouter.ai/docs/api-reference/errors), and RFC 9110 reserves it for payment.
    /// </remarks>
    public static bool IsIndicatedBy(int statusCode, string? errorCode, string text) =>
        statusCode == (int)HttpStatusCode.PaymentRequired ||
        (errorCode is not null && _codes.Any(code => code.Equals(errorCode, StringComparison.OrdinalIgnoreCase))) ||
        IsIndicatedBy(text);

    /// <summary>
    /// Whether a failure's text says the provider's quota is used up - for paths that only see an
    /// exception message or a worker's report, not the vendor's status and body.
    /// </summary>
    /// <param name="text">The failure text.</param>
    /// <returns><see langword="true"/> when the quota is used up.</returns>
    public static bool IsIndicatedBy(string text) =>
        !string.IsNullOrWhiteSpace(text) &&
        (_codes.Any(code => text.Contains(code, StringComparison.OrdinalIgnoreCase)) ||
         _messages.Any(message => text.Contains(message, StringComparison.OrdinalIgnoreCase)));
}
