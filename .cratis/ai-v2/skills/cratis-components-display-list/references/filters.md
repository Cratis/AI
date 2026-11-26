# Search needs to cover unloaded rows

Client filtering can narrow only loaded data. When searching across server pages, pass the query arguments and sort/filter contract to cratis-arc-page-query. Keep no-results-after-filter distinct from a genuinely empty catalog.
