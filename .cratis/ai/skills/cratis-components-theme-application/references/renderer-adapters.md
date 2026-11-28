# Select a renderer by its installed manifest

Start with the Core component and its tokens. If the missing behavior belongs to a renderer, compare the installed adapter’s declared slots and peer dependencies with the host. Do not infer coverage from a vendor name or a fixed count. For example, MUI and Designsystemet can supply `dialogs.dialog`; selecting a dialog renderer does not replace the consumer-facing command dialog API.

Keep configuration decisions separate: `libraryMode` checks what the host promises, `rendererFallback` governs an unresolved slot, and `overlayEnvironment` sets where overlays live. Keep secrets out of renderer setup. Test an actual dialog, including focus return, rather than treating successful provider construction as evidence that the intended renderer was used.
