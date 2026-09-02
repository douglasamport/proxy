# Ore Type — Image Prompts

Thirteen ore types across four tiers. **Keep the trailing style block byte-identical on every prompt** — it is doing most of the consistency work, and small variations in it are the usual reason a set drifts apart visually.

**The shared tail (append to every prompt below):**

> , raw ore specimen, game inventory icon, isolated on transparent background, no ground shadow, dystopian industrial mining game asset, gritty photorealistic, three-quarter view, dramatic rim lighting

---

## Tier 1 — Common

**Copper**
> Copper ore chunk, blue-green verdigris crust over dull orange metallic veins, rough fractured rock matrix, powdery oxidation, chipped edges

**Zinc**
> Zinc ore chunk, dull blue-grey metallic crystals set in pale grey rock, angular crystalline facets, matte chalky surface

**Iron**
> Iron ore chunk, deep rust-red and brown banded hematite, heavy dense mass, flaking oxidised surface, dark metallic sheen inside the fracture

---

## Tier 2 — Precious

**Silver**
> Silver ore chunk, bright metallic threads webbed through dark grey rock, black tarnish patches, wiry native metal growths

**Gold**
> Gold ore chunk, warm yellow veins embedded in white quartz, nuggety lumps, high metallic lustre against dull stone

**Platinum**
> Platinum ore chunk, cool white-silver metallic grains in dark olive rock, dense heavy nuggets, subtle mirror sheen

---

## Tier 3 — Semiconductor

**Silica**
> Silica ore chunk, translucent milky quartz crystal cluster, sharp hexagonal points, glassy conchoidal fractures catching light, faint internal cloudiness

**Germanium**
> Germanium ore chunk, dark grey brittle metallic crystal, high lustre facets, angular fractures, faint bluish sheen

**Cadmium**
> Cadmium ore chunk, soft yellow-tan mineral crust over grey rock, dull earthy texture, powdery ochre patches

---

## Tier 4 — Rare earth

**Neodymium**
> Neodymium ore chunk, violet-purple crystalline mineral in dark matrix, faint internal glow, iridescent facets, oily tarnish film

**Yttrium**
> Yttrium ore chunk, pale silvery-white crystals with faint cyan luminescence, fine needle-like growths, ghostly translucence

**Lanthanum**
> Lanthanum ore chunk, soft white metallic mass with grey oxidation bloom, waxy surface, peeling tarnish layers

**Tantalum**
> Tantalum ore chunk, dense blue-grey metallic nodule, dark oil-slick iridescence, smooth heavy mass with a pitted surface

---

## Notes

**Transparency is unreliable.** Most image generators handle "transparent background" inconsistently — expect some outputs with a white or checkered background regardless of the instruction. Budget for a background-removal pass rather than assuming the prompt handles it.

**These read at 64px or they do not work.** Inventory thumbnails are small. Colour and silhouette are the only cues that survive at that size, which is why each ore above has a distinct hue and a distinct form (crusted / crystalline / nuggety / nodular). If two come back looking similar at thumbnail scale, push the colour further rather than adding detail.

**Generate a tier in one session.** Models drift between sessions. Doing all three tier-1 ores together, then all three tier-2, keeps each tier internally consistent — which matters more than consistency across tiers, since tiers *should* look different from each other.

**Grade variants, if needed later.** The same prompt works for all four grades of an ore by swapping the size and richness language: "small dull fragment" for grade 1 through "large rich specimen, dense with metal" for grade 4. Keep everything else identical.

**Deliberate tier progression.** Tier 1 is dirty and oxidised, tier 2 is metallic and lustrous, tier 3 is crystalline and glassy, tier 4 is exotic and faintly luminous. That escalation should be visible at a glance in the inventory grid — a player should be able to tell they are looking at something valuable before reading the label.
