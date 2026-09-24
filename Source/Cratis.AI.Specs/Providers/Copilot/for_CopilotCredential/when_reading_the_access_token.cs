// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Copilot.for_CopilotCredential;

public class when_reading_the_access_token : Specification
{
    [Fact] void should_read_a_bare_token_as_itself() => CopilotCredential.AccessTokenFor("gho_abc123").ShouldEqual("gho_abc123");

    [Fact] void should_read_the_access_field_of_an_oauth_record() =>
        CopilotCredential.AccessTokenFor("{\"access\":\"gho_abc123\",\"refresh\":\"ghr_x\",\"expires\":1}").ShouldEqual("gho_abc123");

    [Fact] void should_strip_whitespace_pasted_around_a_wrapped_token() =>
        CopilotCredential.AccessTokenFor(" \t\r\ngho_ab\n c123 ").ShouldEqual("gho_abc123");

    [Fact] void should_send_the_token_as_a_bearer() =>
        CopilotCredential.HeadersFor("gho_abc123").ShouldContain(new KeyValuePair<string, string>("Authorization", "Bearer gho_abc123"));

    [Fact] void should_leave_an_oauth_record_untouched_when_normalizing() =>
        CopilotCredential.Normalize("{\"access\": \"gho_abc123\"}").Value.ShouldEqual("{\"access\": \"gho_abc123\"}");
}
