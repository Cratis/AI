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


def _cpu_quota() -> int:
    """How many CPUs this process may actually use, from the cgroup.

    Torch sizes its thread pool from the host's core count, which in a container is the *node's*
    core count, not the quota. Running more OpenMP threads than the quota allows is measurably
    slower than running fewer - the threads spin, the cgroup throttles them, and the work is
    serialised anyway. Benchmarked on the production node: 4 threads against a 2-CPU quota gave
    142 GFLOPS where 2 threads gave 217.
    """
    try:
        with open("/sys/fs/cgroup/cpu.max", encoding="utf-8") as handle:
            quota, period = handle.read().split()
        if quota != "max":
            return max(1, int(int(quota) / int(period)))
    except (OSError, ValueError):
        pass
    return os.cpu_count() or 1


@dataclass(frozen=True)
class Settings:
    """How this instance is configured."""

    model: str = os.environ.get("DECISION_MODEL", "Qwen/Qwen2.5-0.5B-Instruct")
    model_revision: str = os.environ.get("DECISION_MODEL_REVISION", "main")
    runtime: str = os.environ.get("DECISION_RUNTIME", "transformers")

    # Weight precision. bfloat16 measured 3.9x faster than float32 on the production CPU at
    # identical accuracy and calibration, so it is the default. int8 dynamic quantization was
    # measured too and deliberately rejected: it is faster still, but accuracy fell from 46% to
    # 36% and confident-when-wrong overtook confident-when-right, which is the one failure mode
    # a decision engine cannot have.
    dtype: str = os.environ.get("DECISION_DTYPE", "bfloat16")

    # The softmax temperature applied to the choice scores. This is the calibration knob: above
    # 1.0 flattens the distribution, below sharpens it. Tune it against recorded decisions, not
    # against intuition.
    temperature: float = _float("DECISION_TEMPERATURE", 1.0)

    # How many rotations of the option order to average over. A language model carries a
    # positional bias over the option list that has nothing to do with the context; averaging the
    # same question asked with the options rotated cancels it. Measured over 72 labelled
    # decisions: 1 rotation 46% accurate at ECE 0.208, 2 rotations 56% at ECE 0.162, 3 rotations
    # 60% at ECE 0.189 but with confidence separation collapsing from +0.124 to +0.047. Two is
    # the point where accuracy and calibration are both best. Set to 1 to trade accuracy for the
    # lowest possible latency.
    rotations: int = _int("DECISION_ROTATIONS", 2)

    max_choices: int = _int("DECISION_MAX_CHOICES", 32)
    max_batch: int = _int("DECISION_MAX_BATCH", 32)

    # How many prompts go into a single padded forward pass. Bounds peak memory: every row costs
    # a vocabulary-wide logit vector, and the vocabulary here is ~152k wide.
    max_rows: int = _int("DECISION_MAX_ROWS", 16)

    # Contexts are truncated from the front of the free-text section, keeping the most recent end.
    max_context_chars: int = _int("DECISION_MAX_CONTEXT_CHARS", 8000)

    # 0 means "derive it from the cgroup quota", which is right far more often than any number a
    # deployment would hard-code.
    torch_threads: int = _int("DECISION_TORCH_THREADS", 0)

    def resolved_threads(self) -> int:
        """The thread count to actually configure torch with."""
        return self.torch_threads if self.torch_threads > 0 else _cpu_quota()


SETTINGS = Settings()
