namespace Catalog.Authors;

#region docs:command
[Command]
public record RegisterAuthor(AuthorId Id, string Name)
{
    public AuthorRegistered Handle() => new(Name);
}

#endregion docs:command

#region docs:validator
public class RegisterAuthorValidator : CommandValidator<RegisterAuthor>
{
    public RegisterAuthorValidator()
    {
        RuleFor(command => command.Name).NotEmpty();
    }
}
#endregion docs:validator
