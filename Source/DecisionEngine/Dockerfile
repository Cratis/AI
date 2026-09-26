# Stock Laya 4066d5d5fbf08b66c6757ddeedbd797bd7655bc0 is vendored under upstream/.
# Build and runtime follow its CPU Dockerfile; only the command and adapter are Cratis-specific.
ARG PYTHON_IMAGE=python:3.11-slim-bookworm
FROM ${PYTHON_IMAGE} AS build
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ARG TORCH_VERSION=2.14.0
COPY upstream/docker/check_torch.py /opt/check_torch.py
RUN pip install "torch==${TORCH_VERSION}" --index-url https://download.pytorch.org/whl/cpu \
    && python /opt/check_torch.py cpu && pip check
WORKDIR /src
COPY upstream/pyproject.toml upstream/setup.py upstream/README.md upstream/LICENSE ./
COPY upstream/laya/ ./laya/
RUN pip install ".[serve]" && pip check

FROM ${PYTHON_IMAGE} AS runtime
ENV PATH="/opt/venv/bin:$PATH" \
    TORCH_DISABLE_NATIVE_JIT=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    USE_TF=0 \
    USE_TORCH=1 \
    TOKENIZERS_PARALLELISM=false \
    OMP_NUM_THREADS=2 \
    OPENBLAS_NUM_THREADS=2 \
    LAYA_DEVICE=cpu \
    LAYA_PRELOAD=1 \
    LAYA_MODELS=multilingual \
    LAYA_THREADS=2 \
    DECISION_LAYA_MODEL=multilingual \
    HF_HOME=/home/laya/.cache/huggingface
RUN groupadd --gid 10001 laya \
    && useradd --uid 10001 --gid laya --create-home laya \
    && mkdir -p /home/laya/.cache/huggingface \
    && chown -R laya:laya /home/laya/.cache
COPY --from=build /opt/venv /opt/venv
COPY upstream/LICENSE /usr/share/doc/laya/LICENSE
COPY upstream/docker/entrypoint.py /opt/laya/entrypoint.py
COPY adapter.py /opt/laya/adapter.py
USER laya
WORKDIR /home/laya
EXPOSE 8080
ENTRYPOINT ["python", "/opt/laya/entrypoint.py"]
CMD ["uvicorn", "adapter:app", "--app-dir", "/opt/laya", "--host", "0.0.0.0", "--port", "8080"]
