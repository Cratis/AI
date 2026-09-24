// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Copilot.for_CopilotCredential;

/// <summary>
/// Copilot has no metered API key, so "is this usable" is the whole question: a credential that is
/// neither a documented GitHub token format nor an OAuth record carrying an access token
/// authenticates nothing, and is refused where somebody can read the reason rather than inside a
/// container that has already been launched.
/// </summary>
public class when_classifying_a_credential : Specification
{
    [Fact] void should_accept_an_oauth_app_token() => CopilotCredential.IsUsable("gho_abc123").ShouldBeTrue();
    [Fact] void should_accept_a_github_app_user_token() => CopilotCredential.IsUsable("ghu_abc123").ShouldBeTrue();
    [Fact] void should_accept_a_classic_personal_access_token() => CopilotCredential.IsUsable("ghp_abc123").ShouldBeTrue();
    [Fact] void should_accept_a_fine_grained_personal_access_token() => CopilotCredential.IsUsable("github_pat_abc123").ShouldBeTrue();
    [Fact] void should_refuse_an_unset_credential() => CopilotCredential.IsUsable(AIProviderApiKey.NotSet).ShouldBeFalse();
    [Fact] void should_refuse_a_credential_from_another_vendor() => CopilotCredential.IsUsable("sk-ant-api03-abc123").ShouldBeFalse();
    [Fact] void should_not_mistake_an_embedded_prefix_for_a_token() => CopilotCredential.IsUsable("sk-gho_abc123").ShouldBeFalse();
    [Fact] void should_recognize_an_oauth_record() => CopilotCredential.IsOAuthRecord("{\"access\":\"gho_abc123\"}").ShouldBeTrue();
    [Fact] void should_not_mistake_a_bare_token_for_an_oauth_record() => CopilotCredential.IsOAuthRecord("gho_abc123").ShouldBeFalse();

    /// <summary>
    /// GitHub only issues a refresh token and an expiry when the OAuth app has token expiration
    /// enabled, so a record without them is a non-expiring credential rather than a broken one.
    /// </summary>
    [Fact] void should_accept_an_oauth_record_without_a_refresh_token() => CopilotCredential.IsUsable("{\"access\":\"gho_abc123\"}").ShouldBeTrue();

    [Fact] void should_refuse_an_oauth_record_with_no_access_token() => CopilotCredential.IsUsable("{\"refresh\":\"ghr_abc123\"}").ShouldBeFalse();
    [Fact] void should_refuse_a_half_pasted_record() => CopilotCredential.IsUsable("{\"access\":").ShouldBeFalse();
}
