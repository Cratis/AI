# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Model loading and scoring.

The model is loaded once, lazily, on startup. Readiness is gated on that load completing, so a pod
never receives traffic it would answer with a cold-start stall.

One decision is one padded forward pass over its rotations. Decisions are deliberately *not*
batched with each other, even inside a batch request. Measured on the production CPU, folding
thirty decisions into shared passes came out at 292ms per decision against 290ms for scoring them
one at a time - at these sizes the matmuls are already compute-bound, so there is no overhead left
for batching to recover. What it did cost was reproducibility: bfloat16 takes a different kernel
path depending on batch shape, and 3 of 72 decisions changed their top choice purely according to
what else happened to be scored alongside them. A decision that cannot be reproduced from its
recorded inputs is not worth a throughput gain that does not exist.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass
from datetime import UTC, datetime

from .scoring import (
    ANSWER_PREFIX,
    LETTERS,
    MAX_LETTER_CHOICES,
    ScoredChoice,
    build_continuation_prompt,
    build_prompt,
    rotations_of,
)
from .settings import SETTINGS

logger = logging.getLogger(__name__)

_DTYPES = {"bfloat16": "bfloat16", "float16": "float16", "float32": "float32"}


@dataclass(frozen=True)
class ScoringTask:
    """One question to weigh: a rendered context and the choices to score against it."""

    context: str
    choices: list[str]


class DecisionModel:
    """The loaded model, and the one operation performed against it."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._inference_lock = threading.Lock()
        self._tokenizer = None
        self._model = None
        self._loaded_at: datetime | None = None
        self._letter_ids: list[int] = []

    @property
    def is_loaded(self) -> bool:
        """Whether the model is ready to score."""
        return self._model is not None

    @property
    def loaded_at(self) -> datetime | None:
        """When the model finished loading."""
        return self._loaded_at

    def load(self) -> None:
        """Load the configured model. Safe to call more than once."""
        if self._model is not None:
            return

        with self._lock:
            if self._model is not None:
                return

            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer

            threads = SETTINGS.resolved_threads()
            torch.set_num_threads(threads)
            # One inter-op thread: the work here is a single graph, so a second pool only
            # competes with the intra-op pool for the same small CPU quota. Torch refuses this
            # once any parallel work has run, which is not a reason to fail a model load - the
            # default pool is a tuning loss, not a correctness problem.
            try:
                torch.set_num_interop_threads(1)
            except RuntimeError:
                logger.debug("interop thread count already fixed; leaving it alone")
            logger.info("torch configured with %d threads", threads)

            logger.info("loading model %s@%s as %s",
                        SETTINGS.model, SETTINGS.model_revision, SETTINGS.dtype)

            self._tokenizer = AutoTokenizer.from_pretrained(
                SETTINGS.model,
                revision=SETTINGS.model_revision,
            )
            # Left padding, so the last column of every row is a real token and the logits that
            # matter are at index -1 for the whole batch regardless of prompt length.
            self._tokenizer.padding_side = "left"
            if self._tokenizer.pad_token_id is None:
                self._tokenizer.pad_token = self._tokenizer.eos_token

            model = AutoModelForCausalLM.from_pretrained(
                SETTINGS.model,
                revision=SETTINGS.model_revision,
                dtype=getattr(torch, _DTYPES.get(SETTINGS.dtype, "bfloat16")),
            )
            model.eval()
            self._model = model

            # The token id each option letter starts with. Resolved once: it depends only on the
            # tokenizer, and doing it per request showed up in the profile.
            self._letter_ids = [
                self._tokenizer.encode(letter, add_special_tokens=False)[0]
                for letter in LETTERS
            ]

            self._loaded_at = datetime.now(UTC)
            logger.info("model loaded")

    def score(self, tasks: list[ScoringTask]) -> list[list[ScoredChoice]]:
        """Score every task, returning one list of scored choices per task, in order."""
        if self._model is None or self._tokenizer is None:
            raise ModelNotLoaded

        # Choice sets the letter alphabet cannot index fall back to continuation scoring. Slower,
        # but unbounded in choice count, so a caller that legitimately weighs dozens of candidates
        # keeps working rather than being handed a 422 it cannot act on.
        return [
            self._score_by_continuation(task)
            if len(task.choices) > MAX_LETTER_CHOICES
            else self._score_by_letters(task)
            for task in tasks
        ]

    def _score_by_letters(self, task: ScoringTask) -> list[ScoredChoice]:
        """One padded forward pass over the rotations of a single question."""
        import torch

        orders = rotations_of(task.choices, SETTINGS.rotations)
        totals = torch.zeros(len(task.choices), dtype=torch.float32)
        index_of = {choice: slot for slot, choice in enumerate(task.choices)}

        with self._inference_lock:
            for start in range(0, len(orders), SETTINGS.max_rows):
                chunk = orders[start:start + SETTINGS.max_rows]
                log_probs = self._forward(
                    [self._render(task.context, order) for order in chunk]
                )

                for row, order in enumerate(chunk):
                    picked = log_probs[row][self._letter_ids[:len(order)]]
                    for slot, choice in enumerate(order):
                        totals[index_of[choice]] += picked[slot]

        return [
            ScoredChoice(choice, float(totals[slot] / len(orders)))
            for slot, choice in enumerate(task.choices)
        ]

    def _render(self, context: str, choices: list[str]) -> str:
        """Apply the model's chat template to one option order."""
        return self._tokenizer.apply_chat_template(
            [{"role": "user", "content": build_prompt(context, choices)}],
            tokenize=False,
            add_generation_prompt=True,
        ) + ANSWER_PREFIX

    def _forward(self, texts: list[str]):
        """Run one padded batch and return log-probs over the vocabulary at the last position."""
        import torch

        encoded = [self._tokenizer(text, add_special_tokens=False).input_ids for text in texts]
        width = max(len(ids) for ids in encoded)
        pad = self._tokenizer.pad_token_id

        input_ids = torch.full((len(encoded), width), pad, dtype=torch.long)
        attention = torch.zeros((len(encoded), width), dtype=torch.long)
        for row, ids in enumerate(encoded):
            input_ids[row, width - len(ids):] = torch.tensor(ids, dtype=torch.long)
            attention[row, width - len(ids):] = 1

        # Positions must be derived from the mask, not from column index. With left padding the
        # real tokens of a short row start partway across, and rotary embeddings would otherwise
        # place that row's first token at whatever offset the longest row happened to need.
        positions = (attention.cumsum(-1) - 1).clamp(min=0)

        with torch.no_grad():
            # Only the final position is ever read. Without this the model materialises a
            # vocabulary-wide logit vector for every token of every row - at 152k vocabulary and
            # sixteen rows of a few hundred tokens that is gigabytes, for data thrown away.
            output = self._model(
                input_ids,
                attention_mask=attention,
                position_ids=positions,
                logits_to_keep=1,
            )

        return torch.log_softmax(output.logits[:, -1, :].float(), dim=-1)

    def _score_by_continuation(self, task: ScoringTask) -> list[ScoredChoice]:
        """Fallback for choice sets too large to index by letter.

        Scores each choice by its mean per-token log-likelihood as a continuation of the prompt.
        The prompt is encoded once and its attention cache reused across choices, so this costs
        one prefill plus one short pass per choice rather than a full prefill per choice.
        """
        import torch

        prompt = build_continuation_prompt(task.context, task.choices)
        prompt_ids = self._tokenizer(prompt, return_tensors="pt").input_ids
        length = prompt_ids.shape[1]
        scored: list[ScoredChoice] = []

        with self._inference_lock, torch.no_grad():
            prefill = self._model(prompt_ids, use_cache=True)
            cache = prefill.past_key_values
            boundary = torch.log_softmax(prefill.logits[0, -1, :].float(), dim=-1)

            for choice in task.choices:
                choice_ids = self._tokenizer(
                    f" {choice}", return_tensors="pt", add_special_tokens=False,
                ).input_ids
                total = float(boundary[choice_ids[0, 0]])

                if choice_ids.shape[1] > 1:
                    logits = self._model(
                        choice_ids[:, :-1], past_key_values=cache, use_cache=True,
                    ).logits
                    cache.crop(length)
                    log_probs = torch.log_softmax(logits[0].float(), dim=-1)
                    rest = log_probs.gather(1, choice_ids[0, 1:].unsqueeze(-1))
                    total += float(rest.sum())

                scored.append(ScoredChoice(choice, total / choice_ids.shape[1]))

        return scored


class ModelNotLoaded(Exception):
    """Raised when scoring is attempted before the model finished loading."""

    def __init__(self) -> None:
        super().__init__("The decision model is not loaded")


MODEL = DecisionModel()
