// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;

namespace Cratis.AI.Providers.for_TransientProviderFailures.given;

public class a_vendor_response : Specification
{
    protected HttpResponseMessage _response;
    protected AIProviderId _providerId;
    private protected VendorFailure _failure;

    void Establish()
    {
        _providerId = new(Guid.NewGuid());
        _response = new(HttpStatusCode.TooManyRequests);
    }

    void Destroy() => _response.Dispose();
}
