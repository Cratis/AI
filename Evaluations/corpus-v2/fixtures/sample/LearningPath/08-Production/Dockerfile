# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

FROM mcr.microsoft.com/dotnet/sdk:11.0-resolute AS build
WORKDIR /src
COPY Directory.Build.props Directory.Packages.props NuGet.config global.json ./
COPY LearningPath/08-Production/Production.csproj LearningPath/08-Production/
RUN dotnet restore LearningPath/08-Production/Production.csproj
COPY LearningPath/08-Production/*.cs LearningPath/08-Production/
COPY LearningPath/08-Production/appsettings.json LearningPath/08-Production/
RUN dotnet publish LearningPath/08-Production/Production.csproj --configuration Release --no-restore -p:CratisProxiesOutputPath= --output /out

FROM mcr.microsoft.com/dotnet/aspnet:11.0-resolute AS runtime
# Trust only the public CA, using Ubuntu's standard trust store (no TLS bypass).
COPY LearningPath/08-Production/certs/ca.crt /usr/local/share/ca-certificates/learning-path.crt
RUN update-ca-certificates
WORKDIR /app
COPY --from=build /out .
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Production.dll"]
