# shadcn/ui source provenance

Generated from the official `@shadcn` registry with shadcn CLI **4.22.0**, Radix base, Nova style, on 2026-10-17.

- Official setup: https://ui.shadcn.com/docs/installation/vite
- Official components: https://ui.shadcn.com/docs/components/radix/button
- Upstream project / MIT license: https://github.com/shadcn-ui/ui

Commands used:

```sh
npx shadcn@4.22.0 init --base radix --preset nova --no-monorepo --no-rtl --pointer --yes
npx shadcn@4.22.0 add @shadcn/button @shadcn/tabs @shadcn/slider @shadcn/toggle-group @shadcn/field @shadcn/alert @shadcn/input @shadcn/textarea @shadcn/select @shadcn/separator @shadcn/badge --yes
```

The generated neutral theme was changed to the requested Slate light/dark tokens in `playground/style.css`; `components.json` records `slate`. `--pointer` generated the enabled-button cursor policy; Studio also uses pointer/grab cursors for select items, colors, palette buttons and slider thumbs.

Local component changes: Slider accepts `thumbProps` to place `id`, `aria-labelledby` and `aria-valuetext` on the actual focusable slider thumb, and uses semantic `bg-background` for its thumb. Other components retain their generated source. `toggle`, `label` and `separator` are registry dependencies of the selected components.
