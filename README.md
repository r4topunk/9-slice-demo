# Pixel Dress-Up (64x64)

Canvas game to dress a pixel character using a consistent 64x64 mannequin rig. Shirts and pants are layered from a shared pixel spec so everything stays aligned. The current UI and palette direction are inspired by classic Tibia outfit windows.

## Run

```bash
pnpm install
pnpm run dev
```

## Controls

- `ArrowLeft` / `ArrowRight`: change shirt
- `A` / `D`: change pants
- `R`: randomize outfit
- `S`: cycle art direction (Classic / Ember / Aether)
- `F`: toggle fullscreen
- Click the on-canvas buttons

## Pixel Art Pipeline

All pixel art data lives in `assets/pixel-spec.json` as rectangular pixel runs. The spec includes anchors and masks so clothing stays aligned to the mannequin.

Commands:

```bash
pnpm run pixel:validate   # validates bounds + overlap
pnpm run pixel:templates  # regenerates SVG templates
pnpm run pixel:setup      # validate + templates in one go
```

## Proportion + Style Toolkit

Use these scripts when the goal is simple: make sprites look good and keep a clear style direction.

```bash
pnpm run pixel:proportion                    # proportion checks (balanced profile)
pnpm run pixel:proportion -- --profile tibia # proportion checks tuned for tibia-like style
pnpm run pixel:style                         # style checks (clean profile)
pnpm run pixel:style -- --style tibia        # style checks tuned for tibia-like color ramps
pnpm run pixel:doctor                        # combined report in output/pixel-art/proportion-style-report.md
```

Style profiles are configurable in `assets/pixel-style-profiles.json`.

Generated templates are stored in `assets/templates/`:

- `mannequin-template.svg`: base mannequin with anchors
- `clothing-mask-template.svg`: shirt/pants mask guides
- `README.md`: workflow reference

Edit the spec, validate, and then open the SVG templates in your pixel editor to author new clothing while staying aligned with the anchor rig.
