# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Model loading and log-likelihood scoring.

The model is loaded once, lazily, on startup. Readiness is gated on that load completing, so a pod
never receives traffic it would answer with a cold-start stall.
"""

from __future__ import annotations

import logging
import threading
from datetime import UTC, datetime

from .scoring import ScoredChoice
from .settings import SETTINGS

logger = logging.getLogger(__name__)


class DecisionModel:
    """The loaded model, and the one operation performed against it."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._tokenizer = None
        self._model = None
        self._loaded_at: datetime | None = None

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

            if SETTINGS.torch_threads > 0:
                torch.set_num_threads(SETTINGS.torch_threads)

            logger.info("loading model %s@%s", SETTINGS.model, SETTINGS.model_revision)

            self._tokenizer = AutoTokenizer.from_pretrained(
                SETTINGS.model,
                revision=SETTINGS.model_revision,
            )
            model = AutoModelForCausalLM.from_pretrained(
                SETTINGS.model,
                revision=SETTINGS.model_revision,
                dtype=torch.float32,
            )
            model.eval()
            self._model = model
            self._loaded_at = datetime.now(UTC)

            logger.info("model loaded")

    def score(self, prompt: str, choices: list[str]) -> list[ScoredChoice]:
        """Score each choice by its mean per-token log-likelihood given the prompt.

        One forward pass per choice. The choices are short — a handful of tokens each — so the
        dominant cost is the shared prompt prefix, which is why batching the choices into a single
        padded forward pass is the first optimization to reach for if this ever becomes hot.
        """
        if self._model is None or self._tokenizer is None:
            raise ModelNotLoaded

        import torch

        prompt_ids = self._tokenizer(prompt, return_tensors="pt").input_ids
        prompt_length = prompt_ids.shape[1]

        scored: list[ScoredChoice] = []
        with torch.no_grad():
            for choice in choices:
                choice_ids = self._tokenizer(
                    f" {choice}",
                    return_tensors="pt",
                    add_special_tokens=False,
                ).input_ids

                combined = torch.cat([prompt_ids, choice_ids], dim=1)
                logits = self._model(combined).logits

                # Position i predicts token i+1, so the logits that score the choice start one
                # before the choice's own first token.
                choice_logits = logits[0, prompt_length - 1 : -1, :]
                log_probs = torch.log_softmax(choice_logits, dim=-1)
                token_log_probs = log_probs.gather(1, choice_ids[0].unsqueeze(-1)).squeeze(-1)

                scored.append(ScoredChoice(choice, float(token_log_probs.mean())))

        return scored


class ModelNotLoaded(Exception):
    """Raised when scoring is attempted before the model finished loading."""

    def __init__(self) -> None:
        super().__init__("The decision model is not loaded")


MODEL = DecisionModel()
