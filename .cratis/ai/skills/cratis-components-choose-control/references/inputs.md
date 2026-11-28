# Breadcrumb navigation

Supply destinations in order. The last crumb represents the current page, not a link: the component suppresses navigation there. For a router adapter configure `value.router` on the provider rather than passing a top-level `router` prop. Check an intermediate crumb with both keyboard and pointer and check that the current page cannot navigate to itself.
