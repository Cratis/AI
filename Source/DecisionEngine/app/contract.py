# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Decision API v1 wire contract.

Deliberately free of any model-family vocabulary. Callers send context and choices; they get
probabilities back. Swapping the model behind the service must never be visible here.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class DecisionContext(BaseModel):
    """What the choices are weighed against."""

    text: str | None = None
    structured: dict[str, str] | None = None

    def is_empty(self) -> bool:
        """Whether this context carries nothing at all."""
        return not (self.text or "").strip() and not self.structured

    def render(self) -> str:
        """Flatten to the single string the scorer conditions on.

        Structured pairs come first and free text last, so a long body cannot push the structured
        facts out of a truncation window that trims from the end.
        """
        parts: list[str] = []
        if self.structured:
            parts.extend(f"{key}: {value}" for key, value in self.structured.items())
        if self.text and self.text.strip():
            parts.append(self.text.strip())
        return "\n".join(parts)


class DecisionRequest(BaseModel):
    """One bounded question."""

    requestId: str = ""  # noqa: N815 - wire contract is camelCase
    context: DecisionContext
    choices: list[str] = Field(min_length=1)

    @field_validator("choices")
    @classmethod
    def _choices_are_distinct_and_non_empty(cls, choices: list[str]) -> list[str]:
        cleaned = [choice for choice in choices if choice.strip()]
        if len(cleaned) != len(choices):
            raise ValueError("choices must not be blank")
        if len(set(choices)) != len(choices):
            raise ValueError("choices must be distinct")
        return choices


class DecisionBatchRequest(BaseModel):
    """Several independent questions in one round trip."""

    decisions: list[DecisionRequest] = Field(min_length=1)


class DecisionResponse(BaseModel):
    """The normalized distribution over the supplied choices."""

    requestId: str  # noqa: N815 - wire contract is camelCase
    choices: dict[str, float]
    model: str
    engine: str
    latencyMs: float  # noqa: N815 - wire contract is camelCase


class DecisionBatchResponse(BaseModel):
    """One response per request, in the order the requests were supplied."""

    results: list[DecisionResponse]


class ModelInfo(BaseModel):
    """What is currently loaded."""

    model: str
    revision: str
    runtime: str
    loadedAt: str | None  # noqa: N815 - wire contract is camelCase
