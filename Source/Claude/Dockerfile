# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
#
# Worker image the Planner schedules for agent work. Contains the toolchain an agent
# needs to build and test Cratis-based repositories:
#   - .NET 10 SDK
#   - Node.js (latest LTS) with Yarn (via corepack)
#   - Claude CLI (@anthropic-ai/claude-code)
#
# The repository the agent works on is mounted (or cloned) at /workspace.
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
    && rm -rf /var/lib/apt/lists/*

# GitHub CLI — used by the agent to create branches, pull requests and comment on issues.
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Node.js (current LTS line) + Yarn through corepack.
ARG NODE_MAJOR=22
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && corepack enable \
    && rm -rf /var/lib/apt/lists/*

# Claude CLI — the agent runtime. Pin through the build argument when a specific version is needed.
ARG CLAUDE_CLI_VERSION=latest
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CLI_VERSION}

# Non-root user for the agent. Claude CLI refuses --dangerously-skip-permissions as root,
# and work performed in the container should not be privileged anyway.
RUN useradd --create-home --shell /bin/bash agent \
    && mkdir -p /workspace \
    && chown agent:agent /workspace

COPY --chmod=0755 entrypoint.sh /usr/local/bin/entrypoint.sh

USER agent
WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
