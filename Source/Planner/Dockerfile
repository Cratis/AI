# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
#
# Runtime image for the Planner. The frontend (yarn build -> wwwroot) and backend
# (dotnet publish -> out) are built natively on the CI agent; this image only copies
# the published output in.
FROM mcr.microsoft.com/dotnet/aspnet:10.0

# Somewhere for createdump to write. createdump opens the dump file but never creates the
# directory it lives in, so /dumps has to exist in the image or the write simply fails. 1777
# (sticky, world-writable - the /tmp permissions) keeps it writable both as root, the default
# here since the aspnet base image sets no USER, and as whatever UID a Pod securityContext
# imposes instead.
RUN mkdir -p /dumps && chmod 1777 /dumps

WORKDIR /app
COPY out ./

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

# Capture a dump on a native crash. The Planner has an intermittent SIGSEGV (exit 139) that
# produces no log output whatsoever, so without this there is nothing to attach a stack to.
#
# Type 2 (Heap) rather than 4 (Full): Heap keeps every stack and all memory except the mapped
# module images, and those are recoverable from the image anyway. Full materially raises the
# chance of exceeding the pod's ephemeral-storage limit, and overrunning an emptyDir evicts the
# pod - which deletes the very dump being written.
#
# CreateDumpDiagnostics matters here specifically: the entire complaint is "zero log output", so
# a createdump that itself fails - a seccomp profile denying ptrace, say - has to say so on the
# crashing process's console rather than fail silently and leave us exactly as empty-handed.
#
# None of this survives the crashed container unless /dumps is a mounted volume - see
# Documentation/Planner/running-in-the-cloud.md.
ENV DOTNET_DbgEnableMiniDump=1 \
    DOTNET_DbgMiniDumpType=2 \
    DOTNET_DbgMiniDumpName=/dumps/planner.%p.%t.dmp \
    DOTNET_EnableCrashReport=1 \
    DOTNET_CreateDumpDiagnostics=1

ENTRYPOINT ["dotnet", "Planner.dll"]
