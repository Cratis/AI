using Cratis.Arc.Commands;
using Cratis.Arc.Commands.ModelBound;
using FluentValidation;
using Library.Features.Authors;

namespace Library.Features.Authors.Registration;

[Command]
public record RegisterAuthor(AuthorId Id, string Name)
{
    public AuthorRegistered Handle() => new(Name);
}

public class RegisterAuthorValidator : CommandValidator<RegisterAuthor>
{
    public RegisterAuthorValidator() => RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required");
}
