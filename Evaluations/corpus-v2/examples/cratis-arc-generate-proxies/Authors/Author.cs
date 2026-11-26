using Cratis.Arc.MongoDB;
using MongoDB.Driver;
using System.Reactive.Subjects;

namespace Catalog.Authors;

[ReadModel]
[FromEvent<AuthorRegistered>]
public record Author(AuthorId Id, string Name)
{
    #region docs:observable
    public static ISubject<IEnumerable<Author>> AllAuthors(IMongoCollection<Author> collection) =>
        collection.Observe();
    #endregion docs:observable
}
