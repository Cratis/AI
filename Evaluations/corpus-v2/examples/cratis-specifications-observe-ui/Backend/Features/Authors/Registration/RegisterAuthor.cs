using Cratis.Arc.Mcp;

namespace Library.Features.Authors.Registration;

#region docs:command
[Command]
[Cratis.Arc.Authorization.Authorize(Roles = "catalog-editor")]
[ExposeOverMcp("register_author", Description = "Registers an author in the library.")]
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
        RuleFor(command => command.Name).NotEmpty().WithMessage("Name is required");
    }
}
#endregion docs:validator
