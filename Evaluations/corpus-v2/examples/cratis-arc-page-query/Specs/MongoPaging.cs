using Library.Features.Authors.Listing;
using MongoDB.Driver;
using Xunit;

public class MongoPaging
{
    [Fact] public void the_author_query_builds_a_provider_expression_without_materializing_it()
    {
        var collection = new MongoClient("mongodb://localhost:27017").GetDatabase("library").GetCollection<Author>("authors");
        var query = Author.AuthorsNamed("Aster", collection);
        Assert.Contains("Where", query.Expression.ToString());
        Assert.Contains("OrderBy", query.Expression.ToString());
    }
}
