using Cratis.Arc.Commands;
using Cratis.Arc.Testing.Commands;
using NSubstitute;
using Xunit;

namespace Catalog.Authors;

public class AuthorImporter(ICommandPipeline commandPipeline)
{
    public async Task Import(AuthorId id, string name)
    {
        var result = await commandPipeline.Execute(new RegisterAuthor(id, name));
        if (!result.IsSuccess)
        {
            throw new InvalidOperationException($"Could not register author {id}. Correlation: {result.CorrelationId}");
        }
    }
}

public class Invocation
{
    [Theory][InlineData("Aster", true)][InlineData("", false)]
    public async Task import_checks_the_result(string name, bool accepted)
    {
        await using var scenario = new CommandScenario<RegisterAuthor>();
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
