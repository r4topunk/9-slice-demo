# Pixel Art Guide (64x64)

- Canvas: 64x64
- Origin: top-left (x increases right, y increases down)
- Anchor strategy: all clothes are authored against the same mannequin anchors below.

## Anchors

- headCenter: (32, 14)
- neck: (32, 21)
- leftShoulder: (24, 23)
- rightShoulder: (40, 23)
- waist: (32, 35)
- hip: (32, 40)
- leftKnee: (29, 48)
- rightKnee: (35, 48)
- feet: (32, 57)

## Workflow

1. Edit `assets/pixel-spec.json` to adjust body/mask rectangles.
2. Run `pnpm run pixel:validate`.
3. Run `pnpm run pixel:templates` and open generated SVG templates in your pixel editor.
4. Keep shirt pixels inside shirt mask and pants pixels inside pants mask to preserve rig consistency.
