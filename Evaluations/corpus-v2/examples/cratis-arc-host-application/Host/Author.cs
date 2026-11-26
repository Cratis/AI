using System.Reactive.Subjects;
using Cratis.Arc.Authorization;
using Cratis.Arc.Queries.ModelBound;

namespace Probe.Authors;

public sealed class Rows : IDisposable
{
    public BehaviorSubject<IEnumerable<Author>> Changes { get; } = new(Array.Empty<Author>());
    public void Register() => Changes.OnNext([new(Guid.Parse("11111111-1111-4111-8111-111111111111"), "Aster")]);
    public void Dispose() => Changes.Dispose();
}
[ReadModel]
public record Author(Guid Id, string Name)
{
    // Public synthetic rows on a loopback-only, in-memory diagnostic fixture.
    [AllowAnonymous] public static ISubject<IEnumerable<Author>> AllAuthors(Rows rows) => rows.Changes;
    [AllowAnonymous] public static IEnumerable<Author> Snapshot(Rows rows) => rows.Changes.Value;
}
