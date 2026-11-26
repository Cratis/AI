using System.Reactive.Subjects;
using Cratis.Arc.Authorization;
using Cratis.Arc.Queries.ModelBound;

namespace Library.Features.Authors.Listing;

// Transport-only fixture: synthetic documents, not a second domain projection.
public sealed class Rows : IDisposable
{
    public BehaviorSubject<IEnumerable<ProbeRow>> Changes { get; } = new(Array.Empty<ProbeRow>());
    public void Register() => Changes.OnNext([new(Guid.Parse("11111111-1111-4111-8111-111111111111"), "Aster")]);
    public void Dispose() => Changes.Dispose();
}

[ReadModel]
public record ProbeRow(Guid Id, string Name)
{
    [AllowAnonymous] public static ISubject<IEnumerable<ProbeRow>> AllAuthors(Rows rows) => rows.Changes;
    [AllowAnonymous] public static IEnumerable<ProbeRow> Snapshot(Rows rows) => rows.Changes.Value;
}
