# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Specifications for the scoring math.

The model itself is not exercised here — loading half a gigabyte of weights to assert that a
softmax sums to one would test PyTorch, not this service. What is tested is every property a caller
depends on and that a bug here would break silently.
"""

from __future__ import annotations

import math

import pytest

from app.contract import DecisionContext, DecisionRequest
from app.scoring import ScoredChoice, build_prompt, normalize, truncate


class describe_normalizing_scores:
    def it_sums_to_one(self):
        result = normalize(
            [ScoredChoice("a", -1.0), ScoredChoice("b", -2.0), ScoredChoice("c", -3.0)],
            temperature=1.0,
        )
        assert math.isclose(sum(result.values()), 1.0, rel_tol=1e-9)

    def it_covers_every_choice(self):
        result = normalize([ScoredChoice("a", -1.0), ScoredChoice("b", -2.0)], temperature=1.0)
        assert set(result) == {"a", "b"}

    def it_ranks_the_highest_log_likelihood_first(self):
        result = normalize([ScoredChoice("a", -5.0), ScoredChoice("b", -0.5)], temperature=1.0)
        assert result["b"] > result["a"]

    def it_gives_a_single_choice_all_the_mass(self):
        result = normalize([ScoredChoice("only", -7.3)], temperature=1.0)
        assert math.isclose(result["only"], 1.0)

    def it_splits_ties_evenly(self):
        result = normalize([ScoredChoice("a", -2.0), ScoredChoice("b", -2.0)], temperature=1.0)
        assert math.isclose(result["a"], 0.5)
        assert math.isclose(result["b"], 0.5)

    def it_sharpens_as_temperature_falls(self):
        scores = [ScoredChoice("a", -1.0), ScoredChoice("b", -2.0)]
        sharp = normalize(scores, temperature=0.2)
        flat = normalize(scores, temperature=5.0)
        assert sharp["a"] > flat["a"]

    def it_treats_zero_temperature_as_argmax(self):
        result = normalize([ScoredChoice("a", -1.0), ScoredChoice("b", -2.0)], temperature=0.0)
        assert result == {"a": 1.0, "b": 0.0}

    def it_survives_extreme_magnitudes(self):
        result = normalize(
            [ScoredChoice("a", -10_000.0), ScoredChoice("b", -10_001.0)],
            temperature=1.0,
        )
        assert all(math.isfinite(value) for value in result.values())
        assert math.isclose(sum(result.values()), 1.0, rel_tol=1e-9)


class describe_building_a_prompt:
    def it_lists_every_choice(self):
        prompt = build_prompt("something happened", ["investigate", "implement"])
        assert "- investigate" in prompt
        assert "- implement" in prompt

    def it_includes_the_context(self):
        assert "a failing build" in build_prompt("a failing build", ["retry"])


class describe_truncating_context:
    def it_leaves_a_short_context_alone(self):
        assert truncate("short", 100) == "short"

    def it_keeps_the_end_of_a_long_context(self):
        assert truncate("abcdefghij", 3) == "hij"

    def it_treats_a_non_positive_limit_as_no_limit(self):
        assert truncate("abcdefghij", 0) == "abcdefghij"


class describe_a_context:
    def it_is_empty_when_nothing_was_supplied(self):
        assert DecisionContext().is_empty()

    def it_is_empty_when_the_text_is_only_whitespace(self):
        assert DecisionContext(text="   ").is_empty()

    def it_is_not_empty_with_structured_pairs_alone(self):
        assert not DecisionContext(structured={"repository": "Cratis/Direct"}).is_empty()

    def it_renders_structured_pairs_before_free_text(self):
        rendered = DecisionContext(text="the body", structured={"kind": "bug"}).render()
        assert rendered.index("kind: bug") < rendered.index("the body")


class describe_a_request:
    def it_rejects_duplicate_choices(self):
        with pytest.raises(ValueError, match="distinct"):
            DecisionRequest(context=DecisionContext(text="x"), choices=["a", "a"])

    def it_rejects_blank_choices(self):
        with pytest.raises(ValueError, match="blank"):
            DecisionRequest(context=DecisionContext(text="x"), choices=["a", "  "])

    def it_rejects_an_empty_choice_set(self):
        with pytest.raises(ValueError):
            DecisionRequest(context=DecisionContext(text="x"), choices=[])
