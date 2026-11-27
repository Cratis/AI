using Cratis.Arc.Commands;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Queries.ModelBound;
using Cratis.Chronicle;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;
using Cratis.Chronicle.ReadModels;
using Cratis.Chronicle.Projections.ModelBound;
using FluentValidation;
using Xunit;

using Library.Features.Books;
using Library.Features.Books.Stock;

namespace Library.Features.Books.Borrowing;

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
    public async Task refuses_a_stale_borrowing_without_appending_a_second_event()
    {
        using var client = new ChronicleClient(ChronicleOptions.FromDevelopmentConnectionString());
        var store = await client.GetEventStore("library", Guid.NewGuid().ToString());
        var isbn = new Isbn("9780140327243");
        Assert.True((await store.EventLog.Append(isbn, new CopyAdded())).IsSuccess);
        var read = await store.ReadModels.DecisionReads.GetDetached<BookStock>(isbn.Value);
        Assert.True(new BorrowBookValidator(read.Instance).Validate(new BorrowBook(isbn)).IsValid);
        Assert.True((await store.EventLog.Append(isbn, new BookBorrowed())).IsSuccess);
        Assert.True(store.ReadModels.DecisionReads.TryBuildReadSet([read], out var guard));
        var refused = await store.EventLog.Append(isbn, new BookBorrowed(), new AppendOptions { ReadSet = guard });
        Assert.False(refused.IsSuccess);
        Assert.NotNull(refused.ConcurrencyViolation);
        Assert.Single(await store.EventLog.GetForEventSourceIdAndEventTypes(isbn, [typeof(BookBorrowed).GetEventType()]));
    }

    [Fact]
    public void only_allows_borrowing_available_stock()
    {
        var command = new BorrowBook(new Isbn("9780140327243"));
        Assert.False(new BorrowBookValidator(null).Validate(command).IsValid);
        Assert.False(new BorrowBookValidator(new(command.Isbn, 0)).Validate(command).IsValid);
        Assert.True(new BorrowBookValidator(new(command.Isbn, 1)).Validate(command).IsValid);
    }
}
