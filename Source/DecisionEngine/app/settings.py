# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Environment-sourced settings.

Everything operational is configuration, so that replacing the model is a deployment change and
never a code change.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    """How this instance is configured."""

    model: str = os.environ.get("DECISION_MODEL", "Qwen/Qwen2.5-0.5B-Instruct")
    model_revision: str = os.environ.get("DECISION_MODEL_REVISION", "main")
    runtime: str = os.environ.get("DECISION_RUNTIME", "transformers")

    # The softmax temperature applied to mean per-token log-likelihoods. This is the calibration
    # knob: above 1.0 flattens the distribution, below sharpens it. Tune it against recorded
    # decisions, not against intuition.
    temperature: float = _float("DECISION_TEMPERATURE", 1.0)

    max_choices: int = _int("DECISION_MAX_CHOICES", 32)
    max_batch: int = _int("DECISION_MAX_BATCH", 32)

    # Contexts are truncated from the front of the free-text section, keeping the most recent end.
    max_context_chars: int = _int("DECISION_MAX_CONTEXT_CHARS", 8000)

    torch_threads: int = _int("DECISION_TORCH_THREADS", 0)


SETTINGS = Settings()
