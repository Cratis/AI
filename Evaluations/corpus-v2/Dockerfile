# Offline dependency image. Preparation may use the network; trials never can.
FROM node:24-bookworm-slim AS node
FROM mcr.microsoft.com/dotnet/sdk:11.0.100
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm
ENV NUGET_PACKAGES=/opt/nuget DOTNET_CLI_TELEMETRY_OPTOUT=1
WORKDIR /seed
COPY fixtures/sample/ ./
RUN dotnet restore LearningPath/08-Production/Production.Specs/Production.Specs.csproj --source https://api.nuget.org/v3/index.json -p:NuGetAudit=false \
    && dotnet restore Capstone/Capstone.csproj --source https://api.nuget.org/v3/index.json -p:NuGetAudit=false \
    && dotnet tool install Cratis.Screenplay.Tool --version 6.43.0 --tool-path /opt/screenplay
WORKDIR /opt/frontend
COPY fixtures/sample/Capstone/package.json fixtures/sample/Capstone/package-lock.json ./
RUN npm ci --no-audit --no-fund \
    && chmod -R a+rX /opt/nuget /opt/screenplay /opt/frontend
WORKDIR /workspace
CMD ["sleep", "infinity"]
