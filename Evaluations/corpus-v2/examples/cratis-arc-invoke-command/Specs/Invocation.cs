using Cratis.Arc.Commands;
using Cratis.Arc.Testing.Commands;
using NSubstitute;
using Xunit;

using Library.Features.Authors;
using Library.Features.Authors.Registration;
using System.Security.Claims;

public class Invocation
{
    [Theory][InlineData("Aster", true)][InlineData("", false)]
    public async Task import_checks_the_result(string name, bool accepted)
    {
        await using var scenario = new CommandScenario<RegisterAuthor>();
        scenario.WithClaims(new Claim(ClaimTypes.Role, "catalog-editor"));
        var id = AuthorId.New();
        var command = new RegisterAuthor(id, name);
        var result = await scenario.Execute(command);
        var pipeline = Substitute.For<ICommandPipeline>();
        pipeline.Execute(command).Returns(Task.FromResult(result));
        var importer = new AuthorImporter(pipeline);
        if (accepted) await importer.Import(id, name);
        else await Assert.ThrowsAsync<InvalidOperationException>(() => importer.Import(id, name));
        await pipeline.Received(1).Execute(command);
        Assert.Equal(accepted, result.IsSuccess);
        Assert.Equal(accepted, result.IsValid);
    }
}
