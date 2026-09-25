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
from app.scoring import (
    LETTERS,
    MAX_LETTER_CHOICES,
    ScoredChoice,
    build_continuation_prompt,
    build_prompt,
    normalize,
    rotations_of,
    truncate,
)
from app.settings import Settings


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
        assert "investigate" in prompt
        assert "implement" in prompt

    def it_includes_the_context(self):
        assert "a failing build" in build_prompt("a failing build", ["retry"])

    def it_indexes_the_choices_by_letter(self):
        prompt = build_prompt("context", ["investigate", "implement", "ask_user"])
        assert "A. investigate" in prompt
        assert "B. implement" in prompt
        assert "C. ask_user" in prompt

    def it_indexes_in_the_order_supplied(self):
        prompt = build_prompt("context", ["second", "first"])
        assert prompt.index("A. second") < prompt.index("B. first")

    def it_asks_the_generic_question_when_none_is_supplied(self):
        assert "Question: which option applies?" in build_prompt("context", ["retry"])

    def it_asks_the_callers_question(self):
        prompt = build_prompt("context", ["bug", "feature"], question="What kind of issue is this?")
        assert "Question: What kind of issue is this?" in prompt
        assert "which option applies?" not in prompt

    def it_describes_the_described_choices(self):
        prompt = build_prompt("context", ["bug", "feature"], descriptions={"bug": "something is broken"})
        assert "A. bug - something is broken" in prompt
        assert "B. feature\n" in prompt


class describe_rotating_the_option_order:
    def it_produces_the_requested_number_of_orders(self):
        assert len(rotations_of(["a", "b", "c"], 2)) == 2

    def it_starts_from_the_order_supplied(self):
        assert rotations_of(["a", "b", "c"], 2)[0] == ["a", "b", "c"]

    def it_rotates_each_successive_order(self):
        assert rotations_of(["a", "b", "c"], 3) == [
            ["a", "b", "c"], ["b", "c", "a"], ["c", "a", "b"],
        ]

    def it_covers_the_same_choices_in_every_order(self):
        for order in rotations_of(["a", "b", "c", "d"], 4):
            assert sorted(order) == ["a", "b", "c", "d"]

    def it_never_repeats_an_order_already_asked(self):
        # Rotating a two-choice set four times would ask the same two orders twice over, which
        # costs forward passes and adds nothing to the average.
        assert len(rotations_of(["a", "b"], 4)) == 2

    def it_always_asks_at_least_once(self):
        assert len(rotations_of(["a", "b"], 0)) == 1

    def it_is_deterministic(self):
        # A recorded decision has to be reproducible from its inputs, so the orders asked cannot
        # be a shuffle.
        assert rotations_of(["a", "b", "c"], 3) == rotations_of(["a", "b", "c"], 3)


class describe_the_letter_alphabet:
    def it_bounds_how_many_choices_one_pass_can_index(self):
        assert MAX_LETTER_CHOICES == len(LETTERS) == 26

    def it_starts_at_a(self):
        assert LETTERS[0] == "A"


class describe_the_continuation_fallback_prompt:
    def it_lists_every_choice(self):
        prompt = build_continuation_prompt("context", ["investigate", "implement"])
        assert "- investigate" in prompt
        assert "- implement" in prompt

    def it_includes_the_context(self):
        assert "a failing build" in build_continuation_prompt("a failing build", ["retry"])

    def it_asks_no_question_when_none_is_supplied(self):
        assert "Question:" not in build_continuation_prompt("context", ["retry"])

    def it_asks_the_callers_question(self):
        assert "Question: Which label?" in build_continuation_prompt("context", ["retry"], question="Which label?")

    def it_describes_the_described_choices(self):
        descriptions = {"bug": "something is broken"}
        assert "- bug - something is broken" in build_continuation_prompt("context", ["bug"], descriptions=descriptions)


class describe_settings:
    def it_defaults_to_two_rotations(self):
        # Measured over 72 labelled decisions: one rotation scored 46% at ECE 0.208, two scored
        # 56% at ECE 0.162. Changing this default should mean re-running that benchmark.
        assert Settings().rotations == 2

    def it_defaults_to_bfloat16(self):
        assert Settings().dtype == "bfloat16"

    def it_derives_thread_count_when_not_configured(self):
        assert Settings(torch_threads=0).resolved_threads() >= 1

    def it_honours_an_explicit_thread_count(self):
        assert Settings(torch_threads=3).resolved_threads() == 3


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
