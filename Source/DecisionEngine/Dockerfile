# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

FROM python:3.13-slim

# CPU-only torch. The default wheel pulls the full CUDA stack — several gigabytes of libraries this
# service will never execute — so the index is pinned to the CPU build explicitly.
ENV PIP_EXTRA_INDEX_URL=https://download.pytorch.org/whl/cpu \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/models

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# The model cache is a mounted volume in the cluster. Declaring it here means a plain `docker run`
# behaves the same way rather than re-downloading the artifact on every container start.
VOLUME ["/models"]

RUN useradd --create-home --uid 10001 decision && chown -R decision /models /app
USER decision

EXPOSE 8080

# One worker. The model holds several hundred megabytes of weights and each worker would load its
# own copy; scale with replicas, which is also what the resource limits are reasoned about per pod.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
