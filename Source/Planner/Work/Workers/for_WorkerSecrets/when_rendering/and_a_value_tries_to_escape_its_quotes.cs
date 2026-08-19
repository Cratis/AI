// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Work.Workers.for_WorkerSecrets.when_rendering;

/// <summary>
/// The file is sourced by the shell, so a value that could end its own quoting would be executed as
/// script by the entrypoint. That makes the quoting a security property, not formatting.
/// </summary>
public class and_a_value_tries_to_escape_its_quotes : Specification
{
    string _result;

    void Because() => _result = WorkerSecrets.Render(new Dictionary<string, string>
    {
        ["GITHUB_TOKEN"] = "x'; touch /tmp/pwned; echo '"
    });

    [Fact]
    void should_neutralize_the_injected_quote() =>
        _result.ShouldContain(@"GITHUB_TOKEN='x'\''; touch /tmp/pwned; echo '\'''");

    /// <summary>
    /// Every quote in the value is escaped, so the assignment opens and closes exactly once and the
    /// shell reads the whole payload as one string rather than as a command. Counting is the check
    /// that a substring assertion cannot make: an odd count would mean a quote escaped the string.
    /// </summary>
    [Fact]
    void should_leave_the_quoting_balanced() =>
        _result.Split('\n')[1].Count(character => character == '\'').ShouldEqual(8);
}
#endif
