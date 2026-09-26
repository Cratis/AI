#!/usr/bin/env python3
"""Local CPU/2GiB benchmark. Run after starting the named Docker container."""
import concurrent.futures
import json
import os
import statistics
import subprocess
import threading
import time
import urllib.request

BASE = os.environ.get("DECISION_ENGINE_BASE_URL", "http://127.0.0.1:8080").rstrip("/")
CONTAINER = os.environ.get("DECISION_ENGINE_CONTAINER", "cratis-decision-engine")
BODY = json.dumps({"requestId": "benchmark", "context": {"text":
    "Issue: event store throws on empty append. Investigate and return a validation error."},
    "choices": ["investigate", "plan", "implement", "ask_user"]}).encode()


def request():
    start = time.perf_counter()
    req = urllib.request.Request(BASE + "/v1/decisions", data=BODY,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as response:
        result = json.load(response)
    assert len(result["choices"]) == 4
    return (time.perf_counter() - start) * 1000


def stats(stop, samples):
    while not stop.wait(2):
        try:
            raw = subprocess.check_output(["docker", "stats", "--no-stream", "--format",
                "{{.MemUsage}}|{{.CPUPerc}}", CONTAINER], timeout=8, text=True).strip()
            mem, cpu = raw.split("|")
            unit = mem.split("/")[0].strip()
            amount = float(unit[:-3]) * (1024 if unit.endswith("GiB") else 1)
            samples.append({"memoryMiB": round(amount, 1), "cpuPercent": cpu})
        except (OSError, ValueError, subprocess.SubprocessError):
            pass


def summary(values, duration):
    ordered = sorted(values)
    def percentile(p):
        return round(ordered[min(len(ordered)-1, int((len(ordered)-1)*p))], 2)
    return {"count": len(values), "seconds": round(duration, 2),
            "requestsPerSecond": round(len(values)/duration, 2),
            "p50Ms": percentile(.50), "p95Ms": percentile(.95), "p99Ms": percentile(.99),
            "meanMs": round(statistics.mean(values), 2)}


def run(n, workers):
    started = time.perf_counter()
    values, errors = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        for future in concurrent.futures.as_completed([executor.submit(request) for _ in range(n)]):
            try:
                values.append(future.result())
            except Exception as exc:
                errors.append(str(exc))
    duration = time.perf_counter()-started
    return {**(summary(values, duration) if values else {"count": 0}),
            "failures": len(errors), "errorExamples": errors[:3]}


def main():
    stop, samples = threading.Event(), []
    watcher = threading.Thread(target=stats, args=(stop, samples), daemon=True)
    watcher.start()
    result = {"firstRequestMs": round(request(), 2),
              "sequential": run(100, 1), "concurrent4": run(40, 4)}
    stop.set()
    watcher.join(timeout=3)
    result["resources"] = {"samples": len(samples),
        "peakMemoryMiB": max((s["memoryMiB"] for s in samples), default=None),
        "peakCpuPercent": max((float(s["cpuPercent"].strip('%')) for s in samples), default=None)}
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
