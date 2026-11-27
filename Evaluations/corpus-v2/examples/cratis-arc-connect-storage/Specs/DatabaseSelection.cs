using Cratis.Arc.MongoDB;
using Cratis.Arc.Tenancy;
using Microsoft.Extensions.Options;
using NSubstitute;
using Xunit;

public class DatabaseSelection
{
    [Theory][InlineData("default", "library")][InlineData("A", "library+A")]
    public void resolves_the_database_from_reader_settings_and_tenant(string tenant, string expected)
    {
        var settings = Substitute.For<IOptionsMonitor<MongoDBOptions>>();
        settings.CurrentValue.Returns(new MongoDBOptions { Server = "mongodb://localhost:27017", Database = "library" });
        var accessor = Substitute.For<ITenantIdAccessor>();
        accessor.Current.Returns(new TenantId(tenant));
        Assert.Equal(expected, new DefaultMongoDatabaseNameResolver(settings, accessor).Resolve());
    }
}
