# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Choice scoring.

The approach: put the choices to the model as a letter-indexed multiple-choice question and read
the distribution straight off the letter tokens of a single forward pass.

Why not score each choice as a continuation, which is the obvious thing to do? Two reasons, both
measured on the production node against 72 labelled decisions:

* Cost. Scoring choices as continuations needs one forward pass per choice, each re-reading the
  whole prompt, so latency grows with the number of choices - 2.1s at three choices and 4.4s at
  six. Reading letter tokens is one pass regardless: 0.19s at three choices and 0.22s at six.
* Accuracy. A continuation score is contaminated by how likely the choice is as English. The
  string "bug" is common and "breaking-change" is not, and that difference shows up in the score
  whatever the context says. Single-token letters are equally likely a priori, so the only thing
  distinguishing them is the question.

What the letter form introduces is a positional bias - the model favours certain slots in the
list. That is cancelled by asking the same question with the options rotated and averaging, which
is why `rotations` exists. See `Settings.rotations` for the measurements behind the default.
"""

from __future__ import annotations

import math
import string
from dataclasses import dataclass

ENGINE = "single-pass-mcq/v1"

# The alphabet bounds how many choices can be scored in one pass. Past it the engine falls back to
# continuation scoring, which is slower but has no such limit - see `model.py`.
LETTERS = string.ascii_uppercase
MAX_LETTER_CHOICES = len(LETTERS)

PROMPT_TEMPLATE = (
    "{context}\n\n"
    "Question: which option applies?\n\n"
    "{options}\n\n"
    "Answer with the letter of the single best option."
)

ANSWER_PREFIX = "Answer: "

# Used only by the legacy continuation path.
CONTINUATION_TEMPLATE = (
    "You are selecting the single most appropriate option.\n\n"
    "Context:\n{context}\n\n"
    "Options:\n{options}\n\n"
    "The most appropriate option is:"
)


@dataclass(frozen=True)
class ScoredChoice:
    """One choice and the score it was assigned."""

    choice: str
    log_likelihood: float


def rotations_of(choices: list[str], count: int) -> list[list[str]]:
    """The option orders to ask the question in.

    Rotation rather than random shuffling so the set is deterministic: the same request scored
    twice returns the same distribution, which matters when a recorded decision is being audited.
    Capped at the number of choices, because rotating further just repeats an order already asked.
    """
    limit = max(1, min(count, len(choices)))
    return [choices[offset:] + choices[:offset] for offset in range(limit)]


def build_prompt(context: str, choices: list[str]) -> str:
    """Build the multiple-choice prompt body for one option order."""
    options = "\n".join(f"{LETTERS[index]}. {choice}" for index, choice in enumerate(choices))
    return PROMPT_TEMPLATE.format(context=context, options=options)


def build_continuation_prompt(context: str, choices: list[str]) -> str:
    """Build the prompt for the continuation fallback used beyond 26 choices."""
    options = "\n".join(f"- {choice}" for choice in choices)
    return CONTINUATION_TEMPLATE.format(context=context, options=options)


def normalize(scored: list[ScoredChoice], temperature: float) -> dict[str, float]:
    """Softmax the scores into a distribution that sums to one.

    Subtracting the maximum before exponentiating is the standard guard against overflow; a
    degenerate tokenizer result can still produce a large negative, and a silent `inf` here would
    surface as a NaN probability that a caller's threshold comparison would quietly pass.
    """
    if not scored:
        return {}

    if temperature <= 0:
        # Degenerate temperature means "argmax": all mass on the winner.
        best = max(scored, key=lambda item: item.log_likelihood)
        return {item.choice: (1.0 if item is best else 0.0) for item in scored}

    scaled = [item.log_likelihood / temperature for item in scored]
    highest = max(scaled)
    exponentiated = [math.exp(value - highest) for value in scaled]
    total = sum(exponentiated)

    if total <= 0 or not math.isfinite(total):
        uniform = 1.0 / len(scored)
        return {item.choice: uniform for item in scored}

    return {item.choice: value / total for item, value in zip(scored, exponentiated, strict=True)}


def truncate(context: str, limit: int) -> str:
    """Trim an over-long context, keeping the end.

    The end is kept because callers assemble context oldest-first - the most recent step outcome,
    the failure that just happened, is at the bottom and is the part a next-action decision turns on.
    """
    if limit <= 0 or len(context) <= limit:
        return context
    return context[-limit:]
