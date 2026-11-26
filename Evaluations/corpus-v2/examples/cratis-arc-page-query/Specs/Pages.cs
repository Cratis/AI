using Cratis.Arc.Queries;
using Cratis.Arc.Queries.ModelBound;
using Microsoft.EntityFrameworkCore;
using Xunit;

[ReadModel]
public record Row(int Id, string Name)
{
    public static IQueryable<Row> ByName(string name, Catalog db) =>
        db.Rows.Where(row => row.Name == name).OrderBy(row => row.Name).ThenBy(row => row.Id);
}
public class Catalog : DbContext
{
    public DbSet<Row> Rows => Set<Row>();
    protected override void OnConfiguring(DbContextOptionsBuilder builder) => builder.UseSqlite("Data Source=:memory:");
}
public class Pages
{
    [Fact] public async Task filtered_pages_have_stable_keys_even_after_insertion()
    {
        await using var db = new Catalog();
        await db.Database.OpenConnectionAsync(); await db.Database.EnsureCreatedAsync();
        db.AddRange(new Row(2,"Aster"), new Row(3,"Aster"), new Row(4,"Aster"), new Row(9,"Other")); await db.SaveChangesAsync();
        int[] Page(int page, int expectedCount)
        {
            var result = new QueryableQueryRenderer().Execute(Row.ByName("Aster", db), QueryContext.NotSet with { Paging = new Paging(page, 2, true) });
            Assert.Equal(expectedCount, result.TotalItems);
            return ((IQueryable<Row>)result.Data).Select(x => x.Id).ToArray();
        }
        Assert.Equal(new[] {2,3}, Page(0,3)); Assert.Equal(new[] {4}, Page(1,3));
        db.Add(new Row(1,"Aster")); await db.SaveChangesAsync();
        Assert.Equal(new[] {1,2}, Page(0,4)); Assert.Equal(new[] {3,4}, Page(1,4));
    }
}
