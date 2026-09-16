#!/bin/sh
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
#
# Retries a `docker buildx build` invocation on failure. Pushing a large image to a remote registry
# from a CI runner has been observed to fail mid-push with buildx/buildkit's own
# "no active session for <id>: context deadline exceeded" - a known session-timeout limitation of the
# docker-container driver when a push runs long (buildx itself retries the transfer for close to 90s
# before giving up and failing the whole build). Re-running the build reuses the layer cache, so a
# retry here is cheap and recovers from what is otherwise a transient infrastructure flake. Ported
# from Direct's scripts/ (ai-consolidation-plan.md Section 5.6) unchanged - the retry reasoning is
# registry-agnostic.
set -eu

attempts=3
delay=15
n=1
until docker buildx build "$@"; do
  if [ "$n" -ge "$attempts" ]; then
    echo "::error::docker buildx build failed after ${attempts} attempts"
    exit 1
  fi
  echo "Attempt ${n}/${attempts} failed - retrying in ${delay}s..."
  sleep "$delay"
  n=$((n + 1))
done
