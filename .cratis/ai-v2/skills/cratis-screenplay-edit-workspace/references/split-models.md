# Review the composition root

Folder compilation includes every .play file below the root. Keep drafts outside it. Files can contribute different slices to the same feature by repeating the module and feature, but declaring the same slice twice is a duplicate, not a partial declaration. With explicit quoted imports compile the root file and review the resolved import set. Unquoted external contract imports do not load local files.
