namespace Catalog.Authors;

#region docs:command
[Command]
[Cratis.Arc.Authorization.Authorize(Roles = "catalog-editor")]
public record RegisterAuthor(AuthorId Id, string Name)
{
    public AuthorRegistered Handle() => new(Name);
}

#endregion docs:command

#region docs:validator
public sealed class RegisterAuthorValidator : CommandValidator<RegisterAuthor>
{
    public RegisterAuthorValidator() => RuleFor(command => command.Name).NotEmpty();
}
#endregion docs:validator
