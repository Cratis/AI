"""Wire-contract checks without downloading model weights."""
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient


class Router:
    loaded = ["multilingual"]
    loaded_revisions = {"multilingual": "test-revision"}

    def __init__(self, **_kwargs):
        pass

    def preload(self, names):
        assert names == ["multilingual"]

    def predict(self, state, questions, model):
        assert model == "multilingual"
        assert state
        assert len(questions) == 1
        return {"answers": {key: (
            {"probabilities": {name: 1 / len(q["criteria"]) for name in q["criteria"]}}
            if q["type"] == "choice" else {"noul": 0.75}
        ) for key, q in questions.items()}}


class AdapterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        router = types.ModuleType("laya.router")
        router.Router = Router
        serve = types.ModuleType("laya.serve")
        serve.create_app = lambda _router: FastAPI()
        with patch.dict(sys.modules, {"laya.router": router, "laya.serve": serve}):
            source = Path(__file__).parents[1] / "adapter.py"
            if not source.exists():
                source = Path("/opt/laya/adapter.py")
            spec = importlib.util.spec_from_file_location("decision_adapter", source)
            cls.module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(cls.module)
        cls.client = TestClient(cls.module.app)

    def test_probes_and_model(self):
        self.assertEqual(self.client.get("/readyz").status_code, 200)
        self.assertEqual(self.client.get("/v1/model").json()["revision"], "test-revision")
        self.assertEqual(self.client.get("/metrics").status_code, 200)

    def test_structured_only_single_choice_and_empty_request_id(self):
        response = self.client.post("/v1/decisions", json={"context": {"structured": {"issue": "bug"}}, "choices": ["bug"]})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["choices"], {"bug": 1.0})
        self.assertEqual(response.json()["requestId"], "")

    def test_batch_order_and_distribution(self):
        decisions = [{"requestId": str(i), "context": {"text": "some issue"},
                      "choices": ["bug", "task"]} for i in range(3)]
        response = self.client.post("/v1/decisions/batch", json={"decisions": decisions})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([r["requestId"] for r in response.json()["results"]], ["0", "1", "2"])
        self.assertAlmostEqual(sum(response.json()["results"][0]["choices"].values()), 1.0)

    def test_labels_select_multiple(self):
        response = self.client.post("/v1/labels", json={"context": {"text": "A bug"},
            "labels": ["bug", "documentation"], "threshold": 0.5})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["labels"], ["bug", "documentation"])
        self.assertEqual(set(response.json()["probabilities"]), {"bug", "documentation"})

    def test_long_context_is_bounded_for_model(self):
        text = "BEGIN " + "x" * 7900 + " END"
        result = self.module.state(self.module.Context(text=text))
        self.assertTrue(result["text"].startswith("BEGIN "))
        self.assertTrue(result["text"].endswith(" END"))
        self.assertLess(len(result["text"]), 1600)

    def test_many_labels_are_scored_in_bounded_passes(self):
        labels = [f"label-{i}" for i in range(32)]
        response = self.client.post("/v1/labels", json={
            "context": {"text": "A bug"}, "labels": labels})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["labels"], labels)
        self.assertEqual(list(response.json()["probabilities"]), labels)

    def test_invalid_context_and_duplicate_labels(self):
        self.assertEqual(self.client.post("/v1/decisions", json={"context": {}, "choices": ["x"]}).status_code, 422)
        self.assertEqual(self.client.post("/v1/labels", json={"context": {"text": "issue"},
            "labels": ["bug", "bug"]}).status_code, 422)


if __name__ == "__main__":
    unittest.main()
