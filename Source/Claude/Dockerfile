# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
#
# Worker image the Planner schedules for agent work. Contains the toolchain an agent
# needs to build and test the repositories the organization works with:
#   - .NET 10 SDK
#   - Node.js (latest LTS) with Yarn (via corepack)
#   - Java (Temurin LTS), Kotlin and Gradle/Maven
#   - Elixir with Erlang/OTP
#   - Claude CLI (@anthropic-ai/claude-code)
#   - rtk - the token-optimizing CLI proxy every shell command is routed through
#
# and the operational tooling an agent needs to investigate a running system:
#   - GitHub CLI (gh)
#   - Docker CLI with the buildx and compose plugins
#   - Kubernetes CLI (kubectl) with helm and kustomize
#
# The operational tools ship as clients only - no daemon, no cluster. What an agent can actually
# reach is decided entirely by the credentials the Planner hands the container (Planner:Operations),
# so an image with kubectl in it is not an image with access in it.
#
# The repositories the agent works on are cloned under /workspace.

# rtk publishes a static musl binary for amd64 only - build from source elsewhere.
FROM rust:1-slim AS rtk-build
ARG RTK_VERSION=v0.45.0
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && cargo install --locked --git https://github.com/rtk-ai/rtk --tag ${RTK_VERSION} rtk \
    && cp /usr/local/cargo/bin/rtk /rtk

FROM mcr.microsoft.com/dotnet/sdk:10.0

# Tools the agent needs for cloning, diffing and interacting with GitHub.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        gnupg \
        jq \
        unzip \
        zip \
    && rm -rf /var/lib/apt/lists/*

# GitHub CLI — used by the agent to create branches, pull requests and comment on issues.
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Docker CLI (with buildx and compose) and Kubernetes tooling - what an agent investigating an alert
# needs to look at a running system. Clients only: the daemon and the cluster come from whatever
# DOCKER_HOST and kubeconfig the Planner injects, and neither is baked in here.
ARG HELM_VERSION=v3.16.4
# The distribution comes from the base image rather than being assumed: the .NET SDK image is
# Ubuntu-based today, and Docker serves a separate repository per distribution - hard-coding one
# fails the build with a Release-file error that reads like a network problem.
RUN curl -fsSL "https://download.docker.com/linux/$(. /etc/os-release && echo $ID)/gpg" -o /usr/share/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker.asc] https://download.docker.com/linux/$(. /etc/os-release && echo $ID) $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
        > /etc/apt/sources.list.d/docker.list \
    && curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.32/deb/Release.key \
        | gpg --dearmor -o /usr/share/keyrings/kubernetes-archive-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/kubernetes-archive-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.32/deb/ /" \
        > /etc/apt/sources.list.d/kubernetes.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        docker-ce-cli \
        docker-buildx-plugin \
        docker-compose-plugin \
        kubectl \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL "https://get.helm.sh/helm-${HELM_VERSION}-linux-$(dpkg --print-architecture).tar.gz" -o /tmp/helm.tar.gz \
    && tar -xzf /tmp/helm.tar.gz -C /tmp \
    && mv "/tmp/linux-$(dpkg --print-architecture)/helm" /usr/local/bin/helm \
    && rm -rf /tmp/helm.tar.gz "/tmp/linux-$(dpkg --print-architecture)"

# Node.js (current LTS line) + Yarn through corepack.
ARG NODE_MAJOR=22
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && corepack enable \
    && rm -rf /var/lib/apt/lists/*

# Java (Temurin LTS) + Maven; Gradle and Kotlin as pinned distributions. Most JVM repositories
# bring a Gradle wrapper, but the standalone tools cover the rest.
ARG JAVA_MAJOR=21
ARG GRADLE_VERSION=8.14
ARG KOTLIN_VERSION=2.1.20
RUN curl -fsSL https://packages.adoptium.net/artifactory/api/gpg/key/public \
        -o /usr/share/keyrings/adoptium.asc \
    && echo "deb [signed-by=/usr/share/keyrings/adoptium.asc] https://packages.adoptium.net/artifactory/deb $(. /etc/os-release && echo $VERSION_CODENAME) main" \
        > /etc/apt/sources.list.d/adoptium.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends temurin-${JAVA_MAJOR}-jdk maven \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" -o /tmp/gradle.zip \
    && unzip -q /tmp/gradle.zip -d /opt \
    && ln -s /opt/gradle-${GRADLE_VERSION}/bin/gradle /usr/local/bin/gradle \
    && rm /tmp/gradle.zip \
    && curl -fsSL "https://github.com/JetBrains/kotlin/releases/download/v${KOTLIN_VERSION}/kotlin-compiler-${KOTLIN_VERSION}.zip" -o /tmp/kotlin.zip \
    && unzip -q /tmp/kotlin.zip -d /opt \
    && ln -s /opt/kotlinc/bin/kotlinc /usr/local/bin/kotlinc \
    && ln -s /opt/kotlinc/bin/kotlin /usr/local/bin/kotlin \
    && rm /tmp/kotlin.zip

# Elixir with Erlang/OTP through the official installer.
ARG ELIXIR_VERSION=latest
ARG OTP_VERSION=latest
RUN curl -fsSO https://elixir-lang.org/install.sh \
    && sh install.sh elixir@${ELIXIR_VERSION} otp@${OTP_VERSION} \
    && rm install.sh \
    && ln -s "$(ls -d /root/.elixir-install/installs/otp/* | head -1)/bin/"* /usr/local/bin/ \
    && ln -s "$(ls -d /root/.elixir-install/installs/elixir/* | head -1)/bin/"* /usr/local/bin/

# Claude CLI — the agent runtime. Pin through the build argument when a specific version is needed.
ARG CLAUDE_CLI_VERSION=latest
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CLI_VERSION}

# rtk — the token-optimizing proxy. `rtk init -g` (run per user in the entrypoint) installs the
# hook that transparently prefixes the agent's shell commands with it.
COPY --from=rtk-build /rtk /usr/local/bin/rtk

# Non-root user for the agent. Claude CLI refuses --dangerously-skip-permissions as root,
# and work performed in the container should not be privileged anyway.
RUN useradd --create-home --shell /bin/bash agent \
    && mkdir -p /workspace \
    && chown agent:agent /workspace

COPY --chmod=0755 entrypoint.sh /usr/local/bin/entrypoint.sh

USER agent
WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
