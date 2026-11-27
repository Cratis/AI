// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.Concepts;
using Cratis.Json;

namespace LearningPath.Production.Carts.SuiteHidden;

public class for_DiscountCode_contract
{
    [Fact]
    public void should_use_value_equality()
    {
        var first = new DiscountCode("SAVE10");
        Assert.IsAssignableFrom<ConceptAs<string>>(first);
        Assert.Equal(first, new DiscountCode("SAVE10"));
        Assert.NotEqual(first, new DiscountCode("SAVE20"));
    }

    [Fact]
    public void should_round_trip_a_scalar_with_the_framework_converter()
    {
        var options = new JsonSerializerOptions();
        options.Converters.Add(new ConceptAsJsonConverter<DiscountCode>());
        var value = new DiscountCode("SAVE10");
        var json = JsonSerializer.Serialize(value, options);
        Assert.Equal("\"SAVE10\"", json);
        Assert.Equal(value, JsonSerializer.Deserialize<DiscountCode>(json, options));
    }
}
