# Arrangement rules and examples

Use this with the `arrangement` section of `SKILL.md`: the size-class matrix and
the two arrangement kinds stay there; the detailed rules and both examples live
here.

**`arrangement flow`** nests slots under `row`, `column` or `grid` containers.

- A container may declare `gap <n>`.
- A slot leaf takes `width <n>`, `height <n>`, `grow`, and `span <n>` for grid tracks.
- `when width <class>[, height <class>]` or `when height <class>` **replaces the
  entire tree** for that condition — it is not a partial override.

**`arrangement freeform`** declares one variant per matrix point. Excerpt, inside
a `layout` in place of its `arrangement flow`:

```screenplay
arrangement freeform
  variant width regular, height regular
    place navigation at 0,0 size 240,fill
    place content    at 240,0 size fill,fill
  variant width compact, height regular
    place navigation hidden
    place content    at 0,0 size fill,fill
```

`place <Slot> at <x>,<y> size <w>,<h>` where either dimension may be `fill`, or
`place <Slot> hidden` to drop the slot from that variant entirely.
