using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

[DbContext(typeof(Store)), Migration("20261101000100_CreateCatalog")]
public class CreateCatalog : Migration
{
    protected override void Up(MigrationBuilder migration) => migration.CreateTable("Entries", table => new
    {
        Tenant = table.Column<string>(nullable: false), Id = table.Column<int>(nullable: false), Name = table.Column<string>(nullable: false)
    }, constraints: table => table.PrimaryKey("PK_Entries", row => new {row.Tenant,row.Id}));
    protected override void Down(MigrationBuilder migration) => migration.DropTable("Entries");
}
[DbContext(typeof(Store)), Migration("20261102000100_IndexNames")]
public class IndexNames : Migration
{
    protected override void Up(MigrationBuilder migration) => migration.CreateIndex("IX_Entries_Tenant_Name", "Entries", new[]{"Tenant","Name"});
    protected override void Down(MigrationBuilder migration) => migration.DropIndex("IX_Entries_Tenant_Name", "Entries");
}
