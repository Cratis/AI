// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.Concepts;
using Cratis.Json;

namespace LearningPath.Production.Carts.SuiteHidden;

public class for_LoyaltyConcepts_contract
{
    [Fact]
    public void should_preserve_zero_and_value_equality()
    {
        var zero = new LoyaltyPoints(0);
        Assert.IsAssignableFrom<ConceptAs<int>>(zero);
        Assert.Equal(zero, new LoyaltyPoints(0));
        Assert.NotEqual(zero, new LoyaltyPoints(1));
        var options = new JsonSerializerOptions();
        options.Converters.Add(new ConceptAsJsonConverter<LoyaltyPoints>());
        Assert.Equal("0", JsonSerializer.Serialize(zero, options));
        Assert.Equal(zero, JsonSerializer.Deserialize<LoyaltyPoints>("0", options));
    }

    [Fact]
    public void should_round_trip_account_identity()
    {
        var id = Guid.Parse("ab19972c-3985-4988-8156-f49055869882");
        var account = new LoyaltyAccountId(id);
        Assert.IsAssignableFrom<ConceptAs<Guid>>(account);
        var options = new JsonSerializerOptions();
        options.Converters.Add(new ConceptAsJsonConverter<LoyaltyAccountId>());
        Assert.Equal(account, JsonSerializer.Deserialize<LoyaltyAccountId>(JsonSerializer.Serialize(account, options), options));
        Assert.NotEqual(account, new LoyaltyAccountId(Guid.Empty));
    }
}
