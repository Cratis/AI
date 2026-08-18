// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.for_Mentions;

public class when_extracting_mentions : Specification
{
    [Fact]
    void should_find_a_plain_mention() =>
        Mentions.In("cc @octocat please take a look").ShouldContainOnly(new UserName("octocat"));

    [Fact]
    void should_find_multiple_mentions() =>
        Mentions.In("@alice and @bob, thoughts?").ShouldContainOnly(new UserName("alice"), new UserName("bob"));

    [Fact]
    void should_not_match_a_mention_inside_a_fenced_code_block() =>
        Mentions.In("```\nmentioning @octocat here does not count\n```\nbut @realuser does")
            .ShouldContainOnly(new UserName("realuser"));

    [Fact]
    void should_not_match_a_mention_inside_inline_code() =>
        Mentions.In("use `@octocat` as a placeholder, but @realuser is the assignee")
            .ShouldContainOnly(new UserName("realuser"));

    [Fact]
    void should_not_match_an_email_address() =>
        Mentions.In("contact foo@bar.com for details").ShouldBeEmpty();

    [Fact]
    void should_find_a_hyphenated_login() =>
        Mentions.In("assigned to @octo-cat").ShouldContainOnly(new UserName("octo-cat"));

    [Fact]
    void should_match_case_insensitively_and_de_duplicate() =>
        Mentions.In("@Octocat replied, then @octocat replied again").ShouldContainOnly(new UserName("Octocat"));

    [Fact]
    void should_find_nothing_when_there_are_no_mentions() =>
        Mentions.In("just a regular comment with no mentions at all").ShouldBeEmpty();
}
#endif
