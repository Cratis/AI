using Cratis.Specifications;
using Xunit;

public class when_accepting_a_padded_display_name : Specification
{
    string _input = string.Empty;
    string _accepted = string.Empty;

    void Establish() => _input = " Aster ";
    void Because() => _accepted = DisplayName.Accept(_input);

    [Fact] public void should_keep_only_the_significant_text() => Assert.Equal("Aster", _accepted);
}

public static class DisplayName
{
    public static string Accept(string text) => text.Trim();
}
