# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Metrics.

Context text is never recorded. Shape and timing are, because those are what capacity planning and
calibration need and neither requires knowing what anyone asked about.
"""

from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram

REQUESTS = Counter(
    "decision_engine_requests_total",
    "Decision requests served.",
    ["outcome"],
)

LATENCY = Histogram(
    "decision_engine_latency_seconds",
    "How long a decision took.",
    ["phase"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

CHOICES = Histogram(
    "decision_engine_choices_per_request",
    "How many choices each request carried.",
    buckets=(1, 2, 3, 4, 6, 8, 12, 16, 24, 32),
)

TOP_PROBABILITY = Histogram(
    "decision_engine_top_probability",
    "Probability assigned to the winning choice - flat distributions show up here first.",
    buckets=(0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0),
)

MODEL_LOADED = Gauge(
    "decision_engine_model_loaded",
    "Whether the model is loaded and the service can score.",
)
