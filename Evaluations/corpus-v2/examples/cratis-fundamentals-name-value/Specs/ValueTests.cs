using System.Text.Json;
using Cratis.Arc.Chronicle.Testing.Commands;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Testing.Commands;
using Cratis.Chronicle.Events;
using Cratis.Json;
using Xunit;

[EventType] public record AuthorRegistered(string Name);
[Command] public record RegisterAuthor(AuthorId Id, string Name)
{
    public AuthorRegistered Handle() => new(Name);
}

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
        await scenario.ShouldHaveAppendedEventsInOrder(new AuthorRegistered("Aster"));
    }
}
