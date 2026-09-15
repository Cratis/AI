#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

PI_EXTENSION_PACKAGES=(
    '@gotgenes/pi-anthropic-auth'
    '@juicesharp/rpiv-ask-user-question'
    '@juicesharp/rpiv-todo'
    '@narumitw/pi-lsp'
    'context-mode'
    'pi-mcp-adapter'
    'pi-subagents'
    'pi-web-access'
)

PI_EXTENSION_ARGS=()
for package in "${PI_EXTENSION_PACKAGES[@]}"; do
    PI_EXTENSION_ARGS+=(--extension "/home/agent/.pi/agent/npm/node_modules/${package}")
done
