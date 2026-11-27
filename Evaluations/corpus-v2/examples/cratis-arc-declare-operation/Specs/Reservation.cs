using Library.Features.Books.Reservations;
using Cratis.Arc.Testing.Commands;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Library.Specs;

public class Reservation
{
    class TestReservations(bool fail) : IBookReservations
    {
        public Dictionary<ReservationId, BookId> Saved { get; } = [];
        public HashSet<ReservationId> Finalized { get; } = [];
        public Task Reserve(ReservationId id, BookId book, CancellationToken cancellationToken)
        {
            if (Finalized.Contains(id)) throw new InvalidOperationException("Already finalized");
            if (Saved.TryGetValue(id, out var existing) && existing != book) throw new InvalidOperationException("Conflicting book");
            Saved[id] = book;
            return fail ? Task.FromException(new IOException("Acknowledgement lost")) : Task.CompletedTask;
        }
        public Task Cancel(ReservationId id, CancellationToken cancellationToken)
        {
            if (!Finalized.Contains(id)) Saved.Remove(id);
            return Task.CompletedTask;
        }
    }

    [Fact] public async Task reserving_the_same_attempt_twice_does_not_create_a_second_booking()
    {
        var provider = new TestReservations(false);
        var id = new ReservationId(Guid.NewGuid());
        var book = new BookId(Guid.NewGuid());
        await provider.Reserve(id, book, CancellationToken.None);
        await provider.Reserve(id, book, CancellationToken.None);
        Assert.Single(provider.Saved);
    }

    [Theory][InlineData(false)][InlineData(true)] public async Task reverses_only_the_failed_reservation(bool fail)
    {
        var provider = new TestReservations(fail);
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
