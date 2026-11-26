using Catalog.Authors;
using Xunit;

public class Contract
{
    [Fact] public void command_and_read_model_agree_on_identity_and_payload()
    {
        var cmd = new RegisterAuthor(new AuthorId(Guid.NewGuid()), "Aster");
        var author = new Author(cmd.Id, cmd.Handle().Name);
        Assert.Equal(cmd.Id, author.Id);
        Assert.Equal("Aster", author.Name);
    }
}
