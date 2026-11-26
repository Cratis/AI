using Cratis.Arc.Chronicle.Testing.Commands;
using Cratis.Arc.Commands;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Testing.Commands;
using Cratis.Chronicle.Events;
using FluentValidation;
using Xunit;

public record AuthorId(Guid Value) : EventSourceId<Guid>(Value);
[EventType] public record AuthorRegistered(string Name);
[Command] public record RegisterAuthor(AuthorId Id, string Name)
{
    public AuthorRegistered Handle() => new(Name);
}
public class RegistrationValidator : CommandValidator<RegisterAuthor>
{
    public RegistrationValidator() => RuleFor(x => x.Name).NotEmpty();
}
public class Registration
{
    static readonly AuthorId Id = new(Guid.Parse("11111111-1111-4111-8111-111111111111"));

    [Fact] public async Task AppendsToRequestedSource()
    {
        await using var scenario = new CommandScenario<RegisterAuthor>();
        var result = await scenario.Execute(new(Id, "Aster"));
        result.ShouldBeSuccessful();
        await scenario.ShouldHaveAppendedEvent<RegisterAuthor, AuthorRegistered>(Id, x => x.Name == "Aster");
        await scenario.ShouldHaveAppendedEventsInOrder(new AuthorRegistered("Aster"));
    }

    [Fact] public async Task RefusesBlankWithoutAppending()
    {
        await using var scenario = new CommandScenario<RegisterAuthor>();
        var result = await scenario.Execute(new(Id, ""));
        Assert.False(result.IsValid);
        Assert.Contains(result.ValidationResults, e => e.Members.Contains("name", StringComparer.OrdinalIgnoreCase));
        await scenario.ShouldNotHaveAppendedEvents();
    }
}
