using Cratis.Arc.EntityFrameworkCore;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Xunit;

public class Catalog(SqliteConnection connection) : DbContext
{
    protected override void OnConfiguring(DbContextOptionsBuilder options) => options.UseSqlite(connection);
}

[DbContext(typeof(Catalog)), Migration("20260101000000_CreateBooks")]
public class CreateBooks : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("CREATE TABLE Books (Id INTEGER PRIMARY KEY, Title TEXT NOT NULL)");
}

[DbContext(typeof(Catalog)), Migration("20260102000000_AddBookSubtitle")]
public partial class AddBookSubtitle : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.AddStringColumn("Subtitle", "Books", maxLength: 200, nullable: true);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropColumn("Subtitle", "Books");
}

public class SubtitleMigration
{
    [Fact]
    public async Task an_existing_book_survives_the_nullable_column_addition()
    {
        var token = TestContext.Current.CancellationToken;
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync(token);
        await using (var original = new Catalog(connection))
        {
            await original.GetService<IMigrator>().MigrateAsync("CreateBooks", token);
            await original.Database.ExecuteSqlRawAsync("INSERT INTO Books VALUES (7, 'Aster')", token);
        }
        await using var upgraded = new Catalog(connection);
        await upgraded.GetService<IMigrator>().MigrateAsync("AddBookSubtitle", token);
        await using var query = connection.CreateCommand();
        query.CommandText = "SELECT Title FROM Books WHERE Id = 7 AND Subtitle IS NULL";
        Assert.Equal("Aster", await query.ExecuteScalarAsync(token));
        await upgraded.Database.ExecuteSqlRawAsync("UPDATE Books SET Subtitle = 'Field notes' WHERE Id = 7", token);
        query.CommandText = "SELECT Subtitle FROM Books WHERE Id = 7";
        Assert.Equal("Field notes", await query.ExecuteScalarAsync(token));
    }
}
