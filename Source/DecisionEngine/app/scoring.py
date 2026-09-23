# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Choice scoring.

The approach: score each choice by the mean per-token log-likelihood the model assigns it when
conditioned on the context, then softmax over the choices to normalize.

Why not simply ask the model to answer? Because a generated answer gives one token and no
distribution — the caller then has a label it cannot weigh, and a 0.5B model's self-reported
confidence is worthless. Log-likelihood scoring yields a real distribution at a cost of one short
forward pass per choice, which is what makes a small CPU model competitive at this job.

Mean rather than sum per token: a summed log-likelihood is systematically more negative for longer
choices, so `change_approach` would lose to `retry` on length alone regardless of context.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

ENGINE = "logprob-scoring/v1"

PROMPT_TEMPLATE = (
    "You are selecting the single most appropriate option.\n\n"
    "Context:\n{context}\n\n"
    "Options:\n{options}\n\n"
    "The most appropriate option is:"
)


@dataclass(frozen=True)
class ScoredChoice:
    """One choice and the mean per-token log-likelihood it scored."""

    choice: str
    log_likelihood: float


def build_prompt(context: str, choices: list[str]) -> str:
    """Build the prompt every choice is scored against.

    Every choice is listed in the prompt, not just the one being scored. Without the full option
    set the model is scoring "how plausible is this string as a continuation", which is a different
    and much noisier question than "which of these".
    """
    options = "\n".join(f"- {choice}" for choice in choices)
    return PROMPT_TEMPLATE.format(context=context, options=options)


def normalize(scored: list[ScoredChoice], temperature: float) -> dict[str, float]:
    """Softmax the log-likelihoods into a distribution that sums to one.

    Subtracting the maximum before exponentiating is the standard guard against overflow; with
    mean log-likelihoods the magnitudes are small, but a degenerate tokenizer result can still
    produce a large negative, and a silent `inf` here would surface as a NaN probability that a
    caller's threshold comparison would quietly pass.
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

    The end is kept because callers assemble context oldest-first — the most recent step outcome,
    the failure that just happened, is at the bottom and is the part a next-action decision turns on.
    """
    if limit <= 0 or len(context) <= limit:
        return context
    return context[-limit:]
