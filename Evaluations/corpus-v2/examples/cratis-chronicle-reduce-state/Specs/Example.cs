using Cratis.Chronicle.Events;
using Xunit;

namespace Library.Books.Availability;

[EventType] public record BookAdded(int Copies);
[EventType] public record BookBorrowed;

public record BookAvailability(int Copies, int OnLoan)
{
    public static BookAvailability Reduce(BookAdded @event, BookAvailability? current) =>
        new(@event.Copies, 0);

    public static BookAvailability? Reduce(BookBorrowed @event, BookAvailability? current) =>
        current is null ? null : current with { OnLoan = Math.Min(current.Copies, current.OnLoan + 1) };
}

public class BookAvailabilityTests
{
    [Fact]
    public void counts_loans_only_for_added_books_up_to_the_number_of_copies()
    {
        var borrowed = new BookBorrowed();
        Assert.Null(BookAvailability.Reduce(borrowed, null));
        var added = BookAvailability.Reduce(new BookAdded(2), null);
        var first = BookAvailability.Reduce(borrowed, added);
        var second = BookAvailability.Reduce(borrowed, first);
        Assert.Equal(new BookAvailability(2, 1), first);
        Assert.Equal(new BookAvailability(2, 2), second);
        Assert.Equal(second, BookAvailability.Reduce(borrowed, second));
        Assert.Equal(0, added.OnLoan);
    }
}
