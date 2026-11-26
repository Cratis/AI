using Cratis.Arc.Commands;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Queries.ModelBound;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Projections.ModelBound;
using FluentValidation;
using Xunit;

namespace Library.Books.Borrowing;

public record Isbn(string Value) : EventSourceId<string>(Value);
[EventType] public record CopyAdded;
[EventType] public record BookBorrowed;

[ReadModel]
public record BookStock(Isbn Id, [Increment<CopyAdded>, Decrement<BookBorrowed>] int Available);

[Command]
public record BorrowBook(Isbn Isbn)
{
    public BookBorrowed Handle() => new();
}

public class BorrowBookValidator : CommandValidator<BorrowBook>
{
    public BorrowBookValidator(BookStock? stock) =>
        RuleFor(command => command.Isbn)
            .Must(_ => stock is { Available: > 0 })
            .WithMessage("No copies of this book are available.");
}

public class BorrowingTests
{
    [Fact]
    public void only_allows_borrowing_available_stock()
    {
        var command = new BorrowBook(new Isbn("123"));
        Assert.False(new BorrowBookValidator(null).Validate(command).IsValid);
        Assert.False(new BorrowBookValidator(new(command.Isbn, 0)).Validate(command).IsValid);
        Assert.True(new BorrowBookValidator(new(command.Isbn, 1)).Validate(command).IsValid);
    }
}
