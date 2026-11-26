using Cratis.Arc.Commands;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Testing.Commands;
using Cratis.Concepts;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Catalog.Books;

public record ReservationId(Guid Value) : ConceptAs<Guid>(Value);
public record BookId(Guid Value) : ConceptAs<Guid>(Value);

public interface IBookReservations
{
    Task Reserve(ReservationId id, BookId book, CancellationToken cancellationToken);
    Task Cancel(ReservationId id, CancellationToken cancellationToken);
}

[Command]
public record ReserveBook(ReservationId Id, BookId Book)
{
    public ReserveBookOperation Handle() => new(Id, Book);
}

public record ReserveBookOperation(ReservationId Id, BookId Book) : ICommandOperation
{
    public Task Execute(IBookReservations reservations, CancellationToken cancellationToken) =>
        reservations.Reserve(Id, Book, cancellationToken);

    public Task Compensate(IBookReservations reservations, CancellationToken cancellationToken) =>
        reservations.Cancel(Id, cancellationToken);
}

public class Reservation
{
    class BookReservations(bool fail) : IBookReservations
    {
        public Dictionary<ReservationId, BookId> Saved { get; } = [];
        public HashSet<ReservationId> Finalized { get; } = [];
        public Task Reserve(ReservationId id, BookId book, CancellationToken cancellationToken)
        {
            if (Finalized.Contains(id)) throw new InvalidOperationException("Already finalized");
            Saved.Add(id, book);
            return fail ? Task.FromException(new IOException("Acknowledgement lost")) : Task.CompletedTask;
        }
        public Task Cancel(ReservationId id, CancellationToken cancellationToken)
        {
            if (!Finalized.Contains(id)) Saved.Remove(id);
            return Task.CompletedTask;
        }
    }

    [Theory][InlineData(false)][InlineData(true)] public async Task reverses_only_the_failed_reservation(bool fail)
    {
        var provider = new BookReservations(fail);
        var prior = new ReservationId(Guid.NewGuid());
        var book = new BookId(Guid.NewGuid());
        provider.Saved.Add(prior, book);
        provider.Finalized.Add(prior);
        await using var scenario = new CommandScenario<ReserveBook>();
        scenario.Services.AddSingleton<IBookReservations>(provider);
        var result = await scenario.Execute(new ReserveBook(new(Guid.NewGuid()), book));
        Assert.Equal(!fail, result.IsSuccess);
        Assert.True(provider.Saved.ContainsKey(prior));
        Assert.Equal(fail ? 1 : 2, provider.Saved.Count);
        if (fail) scenario.ShouldHaveCompensatedOperation<ReserveBookOperation>(); else scenario.ShouldHaveExecutedOperation<ReserveBookOperation>();
    }
}
