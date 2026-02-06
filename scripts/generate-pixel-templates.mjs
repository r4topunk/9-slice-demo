import { loadSpec, rectToSvg, writeFileSafe } from './pixel-utils.mjs'

const spec = loadSpec()

const drawAnchors = Object.entries(spec.anchors)
  .map(([name, [x, y]]) => {
    return [
      `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="1.2" fill="#ffffff" stroke="#101010" stroke-width="0.6"/>`,
      `<text x="${x + 2.5}" y="${y - 1.5}" font-size="3" fill="#101010">${name}</text>`
    ].join('\n')
  })
  .join('\n')

const modelSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${spec.size} ${spec.size}" shape-rendering="crispEdges">
  <rect width="${spec.size}" height="${spec.size}" fill="#f1e8d8"/>
  ${rectToSvg(spec.base.outline, spec.palettes.outline)}
  ${rectToSvg(spec.base.skinLight, spec.palettes.skin.light)}
  ${rectToSvg(spec.base.skinBase, spec.palettes.skin.base)}
  ${rectToSvg(spec.base.skinShadow, spec.palettes.skin.shadow)}
  ${rectToSvg(spec.base.hairLight, spec.palettes.hair.light)}
  ${rectToSvg(spec.base.hairBase, spec.palettes.hair.base)}
  ${rectToSvg(spec.base.hairShadow, spec.palettes.hair.shadow)}
  ${rectToSvg(spec.boots.outline, spec.palettes.outline)}
  ${rectToSvg(spec.boots.fill, '#3f3027')}
  ${drawAnchors}
</svg>`

const clothingSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${spec.size} ${spec.size}" shape-rendering="crispEdges">
  <rect width="${spec.size}" height="${spec.size}" fill="#fff"/>
  ${rectToSvg(spec.shirt.light, '#ffb7b7')}
  ${rectToSvg(spec.shirt.base, '#ff6f78')}
  ${rectToSvg(spec.shirt.shadow, '#8a2b34')}
  ${rectToSvg(spec.shirt.pattern, '#ffeaea', 0.8)}
  ${rectToSvg(spec.pants.light, '#b2bddf')}
  ${rectToSvg(spec.pants.base, '#6078be')}
  ${rectToSvg(spec.pants.shadow, '#2a3c73')}
  ${rectToSvg(spec.pants.pattern, '#dce2ff', 0.85)}
  ${drawAnchors}
</svg>`

const guideMd = `# Pixel Art Guide (${spec.size}x${spec.size})

- Canvas: ${spec.size}x${spec.size}
- Origin: top-left (x increases right, y increases down)
- Anchor strategy: all clothes are authored against the same mannequin anchors below.

## Anchors

${Object.entries(spec.anchors)
  .map(([name, value]) => `- ${name}: (${value[0]}, ${value[1]})`)
  .join('\n')}

## Workflow

1. Edit \
\`assets/pixel-spec.json\` to adjust body/mask rectangles.
2. Run \
\`pnpm run pixel:validate\`.
3. Run \
\`pnpm run pixel:templates\` and open generated SVG templates in your pixel editor.
4. Keep shirt pixels inside shirt mask and pants pixels inside pants mask to preserve rig consistency.
`

const a = writeFileSafe('assets/templates/mannequin-template.svg', modelSvg)
const b = writeFileSafe('assets/templates/clothing-mask-template.svg', clothingSvg)
const c = writeFileSafe('assets/templates/README.md', guideMd)
console.log(`Generated:\n- ${a}\n- ${b}\n- ${c}`)
