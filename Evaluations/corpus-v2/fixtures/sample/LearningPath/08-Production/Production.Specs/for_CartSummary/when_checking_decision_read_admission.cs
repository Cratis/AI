// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts.for_CartSummary;

public class when_checking_decision_read_admission : Specification
{
    [Fact] void should_admit_the_cart_projection_for_all_commands() =>
        DecisionReadAdmissions.ShouldAdmitDecisionReadsOf(typeof(AddItemToCart), typeof(RemoveItemFromCart), typeof(CheckOutCart));
}
