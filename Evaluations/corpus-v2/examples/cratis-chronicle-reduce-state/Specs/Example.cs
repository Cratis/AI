using Cratis.Chronicle.Events;
using Xunit;

[EventType] public record AuthorRegistered(string Name);

public record RegistrationHistory(string FirstName, int Count)
{
    public static RegistrationHistory Reduce(AuthorRegistered fact, RegistrationHistory? current) =>
        current is null ? new(fact.Name, 1) : current with { Count = current.Count + 1 };
}

public class Reduction
{
    [Fact]
    public void reconstructs_state_independently_for_each_key()
    {
        (string Key, AuthorRegistered Fact)[] facts = [("a", new("Aster")), ("b", new("Elm")), ("a", new("Birch"))];
        Dictionary<string, RegistrationHistory> Replay()
        {
            var rows = new Dictionary<string, RegistrationHistory>();
            foreach (var (key, fact) in facts) rows[key] = RegistrationHistory.Reduce(fact, rows.GetValueOrDefault(key));
            return rows;
        }
        var initial = Replay();
        Assert.Equal(new RegistrationHistory("Aster", 2), initial["a"]);
        Assert.Equal(new RegistrationHistory("Elm", 1), initial["b"]);
        Assert.Equal(initial, Replay());
    }
}
