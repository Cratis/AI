using Cratis.Arc.Commands;

namespace Library.Features.Authors.Registration;

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
