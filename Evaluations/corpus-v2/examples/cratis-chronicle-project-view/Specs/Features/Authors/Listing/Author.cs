using Cratis.Arc.Queries.ModelBound;
using Cratis.Chronicle.Projections.ModelBound;
using Library.Features.Authors;
using Library.Features.Authors.Registration;
using Library.Features.Authors.Removal;

namespace Library.Features.Authors.Listing;

[ReadModel, FromEvent<AuthorRegistered>, RemovedWith<AuthorRemoved>]
public record Author(AuthorId Id, string Name);
