using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Xunit;

public record Entry(string Tenant, int Id, string Name);
public class Store(SqliteConnection connection) : DbContext
{
    public DbSet<Entry> Entries => Set<Entry>();
    protected override void OnConfiguring(DbContextOptionsBuilder options) => options.UseSqlite(connection);
    protected override void OnModelCreating(ModelBuilder model) => model.Entity<Entry>().HasKey(x => new { x.Tenant, x.Id });
}
public class Stored
{
    [Fact] public async Task a_fresh_context_reads_only_the_committed_partition()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        await using (var db = new Store(connection))
        {
            await db.GetService<IMigrator>().MigrateAsync("20261101000100_CreateCatalog", TestContext.Current.CancellationToken);
            db.AddRange(new Entry("A",1,"Aster"),new Entry("B",1,"Birch")); await db.SaveChangesAsync();
        }
        await using var read = new Store(connection);
        await read.GetService<IMigrator>().MigrateAsync("20261102000100_IndexNames", TestContext.Current.CancellationToken);
        Assert.Contains("20261102000100_IndexNames", await read.Database.GetAppliedMigrationsAsync(TestContext.Current.CancellationToken));
        Assert.Equal("Aster", (await read.Entries.SingleAsync(x => x.Tenant == "A" && x.Id == 1)).Name);
        Assert.Equal("Birch", (await read.Entries.SingleAsync(x => x.Tenant == "B" && x.Id == 1)).Name);
    }
}
