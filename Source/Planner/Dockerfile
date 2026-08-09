# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
#
# Runtime image for the Planner. The frontend (yarn build -> wwwroot) and backend
# (dotnet publish -> out) are built natively on the CI agent; this image only copies
# the published output in.
FROM mcr.microsoft.com/dotnet/aspnet:10.0

WORKDIR /app
COPY out ./

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "Planner.dll"]
