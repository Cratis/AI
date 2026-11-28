# Read the view through its owner

There is no released Python application projection. Ask the service owning the projection for the keyed result. Return missing as missing, not as a constructed empty model. Check that the service can rebuild the same instance before relying on a Python-side cache.
