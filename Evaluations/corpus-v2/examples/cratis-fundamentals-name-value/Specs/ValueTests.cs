using System.Text.Json;
using Cratis.Arc.Chronicle.Testing.Commands;
using Cratis.Arc.Testing.Commands;
using Cratis.Json;
using Library.Features.Authors;
using Library.Features.Authors.Registration;
using Xunit;

public class ValueTests
{
    [Fact] public void NameIsAScalar()
    {
        var options = new JsonSerializerOptions { Converters = { new ConceptAsJsonConverterFactory() } };
        var name = new AuthorName("Aster");
        var json = JsonSerializer.Serialize(name, options);
        Assert.Equal("\"Aster\"", json);
        Assert.Equal(name, JsonSerializer.Deserialize<AuthorName>(json, options));
    }

    [Fact] public async Task DispatchSelectsTheAuthor()
    {
        var id = new AuthorId(Guid.Parse("11111111-1111-4111-8111-111111111111"));
        await using var scenario = new CommandScenario<RegisterAuthor>();
        var result = await scenario.Execute(new(id, "Aster"));
        result.ShouldBeSuccessful();
        await scenario.ShouldHaveAppendedEvent<RegisterAuthor, AuthorRegistered>(id, e => e.Name == "Aster");
    }
}
