using Cratis.Arc.MongoDB;
using MongoDB.Driver;
using System.Reactive.Subjects;

using Cratis.Arc.Mcp;
using Library.Features.Authors.Registration;
using Library.Features.Authors.Removal;
using MongoDB.Driver.Linq;

namespace Library.Features.Authors.Listing;

[ReadModel]
[FromEvent<AuthorRegistered>]
[RemovedWith<AuthorRemoved>]
public record Author(AuthorId Id, string Name)
{
    #region docs:observable
    public static ISubject<IEnumerable<Author>> AllAuthors(IMongoCollection<Author> collection) =>
        collection.Observe();
    #endregion docs:observable

    public static IQueryable<Author> AuthorsNamed(string name, IMongoCollection<Author> collection) =>
        collection.AsQueryable().Where(author => author.Name == name).OrderBy(author => author.Id);

    [ExposeOverMcp("list_authors", Description = "Lists the library's authors.")]
    public static IEnumerable<Author> ListAuthors(IMongoCollection<Author> collection) =>
        collection.Find(_ => true).ToList();
}
