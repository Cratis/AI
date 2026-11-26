using Catalog.Authors;
using Cratis.Arc.Queries.ModelBound;
using Cratis.Chronicle.Projections.ModelBound;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Catalog.PagedAuthors;

[ReadModel]
[FromEvent<AuthorRegistered>]
public record Author(AuthorId Id, string Name)
{
    public static IQueryable<Author> AuthorsNamed(string name, IMongoCollection<Author> collection) =>
        collection.AsQueryable().Where(author => author.Name == name).OrderBy(author => author.Id);
}
