# Room artwork

The planner uses custom room illustrations generated with the built-in ImageGen tool. The wide atlas used the two room atlases as visual references. [Room reference gallery](https://fallout-archive.fandom.com/wiki/Category:Fallout_Shelter_room_images)

WebP assets are in [public/vault-art](../public/vault-art). The map shows the room's level and occupancy over the artwork.

## ImageGen prompts

Common prompt for the two room atlases:

```text
Use case: stylized-concept, game art sprite atlas for an underground vault layout editor. Create ONE 1536x1024 landscape contact sheet of exactly 16 separate full-bleed tiles in an even 4 columns by 4 rows grid. Strict geometry: dividing lines are at 25%, 50%, and 75% of the canvas on both axes. Each tile is an independent, same scale, front-facing open-wall cutaway diorama of an underground room, a tiny 1950s retrofuturistic vault with chunky hand-painted 3D game props. Architecture feels like a Fallout Shelter underground game screenshot: industrial metal and concrete, open front, slight view of the floor from above, side walls receding toward the central back wall, clearly outlined stylized proportions, soft dark corners, warm overhead fixtures, colored machinery in a muted atmosphere. Room walls and fixtures extend to fill the tile; a clean dark horizontal ceiling at the top and metal flooring along the bottom of each tile. The four rows must have the same height, all four columns the same width, all rooms centered within their grid cells. No gutters, no margins, no white lines, no text, no room numbers, no logos, no interface, no dweller characters. Don't let any object cross into another tile. Each tile must have legible unique room details and a varied but coordinated color palette.
```

### room-atlas-a

```text
Rooms in EXACT row-major order:
Row 1: (1) vault doorway with circular steel safe door with gear teeth in ochre concrete and a black hazard-stripe floor, (2) gray elevator lift doors and shaft rails with warm signal lamp, (3) residential quarters with green-blue bunk beds and end tables, (4) yellow industrial generator room with two squat turbines and metal pipework.
Row 2: (1) retro bright red and cream diner with striped booths and round stools, (2) blue-green water treatment with cylindrical blue tanks, filters and piping, (3) warm dim warehouse with stacked wooden crates and shelves, (4) red and white medical bay with examination beds and white cabinets.
Row 3: (1) cool blue science lab with glass lab tubes and chemistry benches, (2) brown overseer's office with curved desk, radial filing shelves and green screen, (3) purple-lit radio studio with studio microphones and massive reel-to-reel equipment, (4) olive weapons workshop with weapon racks and a tool bench.
Row 4: (1) strength gym with weight racks and benches, (2) yellow agility training room with traffic cones and obstacle course, (3) dark ochre armory with firing targets and organized firearm lockers, (4) amber classroom with rows of school desks and a dark green chalkboard.
```

### room-atlas-b

```text
Rooms in EXACT row-major order:
Row 1: (1) outfit workshop, rubbery workshop tables, dress forms and stitched fabric rolls, (2) peach fitness studio with treadmills and stationary cycles, (3) amber lounge with chestnut sofas and potted plants, (4) theme workshop with model architectural decor, desks and sketches.
Row 2: (1) recreation arcade with colorful vintage pinball tables, (2) turquoise barber shop with vintage barber chairs and basins, (3) heavy yellow nuclear reactor industrial room with a massive electric reactor core, copper coils and cooling tubes, (4) lush green underground garden with rows of planters and fluorescent grow lights.
Row 3: (1) bright blue late-game water purification plant with many clean silver tanks and metal catwalks, (2) red and white cola bottling factory with green glass bottles on conveyor, stainless filler heads and red pipes, (3) empty cross-section of dark brown underground rock with exposed veins and small embedded stones, (4) sealed rough brown stone boulders in excavation space.
Row 4: (1) sandy wasteland ground with barren shrubs at the top and exposed soil cross section below, (2) empty unexcavated brown bedrock with subtle sediment veins, (3) dark gray industrial support wall with stained concrete, (4) very dark earthy charcoal bedrock texture with faint stones for a background.
```

### Wide rooms

```text
Use case: stylized-concept, wide room image atlas for a Fallout Shelter inspired vault layout editor. Reference images 1 and 2 establish the materials, lighting and straight-on room framing. Generate a NEW 1536×1024 landscape atlas with exactly 8 wide cutaways arranged in 2 columns by 4 equal rows, each tile with a 3:1 aspect ratio. Strict 50% vertical division and horizontal divisions at 25%, 50%, 75%. Every room fills its own tile, bounded by a dark straight metal roof and floor, at the same scale, equal width and height. Each cross section must be ONE continuous room stretching from left to right with multiple different clusters of props. Bright retrofuturistic stylized game environment, readable at thumbnail scale, lights cast warmly on illustrated 3D props, subtle receding side walls, camera exactly frontal, no furnishings cut off. Saturated game-like local color. No gutter, no labels, no overlays, no words, no emblems, no people. Top row left a yellow two-turbine power generator hall with pipes and panels, right big nuclear reactor with illuminated yellow core, cooling pipes, industrial railings. Second row left a cool blue water treatment hall, three water tanks and filter tubing, right a red and cream midcentury diner with a counter at left and red booth seating at right. Third row left a red and steel cola bottler with conveyor and rows of green glass bottles, right a large bunker dormitory with green bunk beds and simple lamps. Bottom row left a red and white medical ward with multiple examination beds and drug cabinets, right a blue chemistry lab with a row of workbenches and luminous test tubes. Edge-to-edge all 8 exactly in this order.
```

## Width variants

The application uses one proportion-preserving illustration for every allowed room type and width. Each ImageGen atlas was sliced into WebP files named by room ID and section count. The illustrated view and PNG export use the same center crop. Upgrade levels share the illustration for their room type and width.

ImageGen used the original three atlases as visual references.

```text
Use case: stylized-concept.
Game-art atlas of illustrated underground vault rooms. The references establish the visual language: frontal Fallout Shelter-inspired cutaway dioramas, visible ceilings and floor edges, a subtle view of the floor and receding side walls, stylized warm lighting and recognizable retrofuturistic props. Draw new wider rooms as continuous interiors, with different groups of furniture along the back wall and beams only on the outside edges. No vertical partition or copy-pasted furniture set inside a tile. Draw all architecture and props within the tile. All tiles are the same width and height and exactly fill the canvas, no gutters, no white lines, no labels, no words, no people. Preserve the same coherent lighting and palette as the reference. The room on the left of a tile is not duplicated on the right: one coherent space.
```

### double-a

```text
1536×1024 landscape, EXACT 3 columns × 4 equal rows, each room tile 512×256 (2:1). Vertical tile boundaries are exactly at one-third and two-thirds of the entire image. Row boundaries exactly 25%, 50%, and 75%. Room order left to right:
Row 1: green and blue living quarters, separate bunks and seating; industrial golden power generator, turbine on the left and pipe controls on the right; bright red 1950s diner, stools at the counter and booths at the right.
Row 2: teal blue water treatment with tanks and filtration pipes; brown wooden storage crates and shelves; red and white medical bay, examination bed left and lockers right.
Row 3: blue chemistry lab with benchtops and green vials; purple radio studio, microphone desk and reel tape machine; brown and ochre strength-gym with weight racks and workout benches.
Row 4: amber agility room with cones and hurdles; olive armory and shooting range with targets and weapon racks; a warm amber classroom with desks and a large green chalkboard.
```

### double-b

```text
1536×1024 landscape, EXACT 3 columns × 4 equal rows, each room tile 512×256 (2:1). Vertical tile boundaries are exactly at one-third and two-thirds of the entire image. Row boundaries exactly 25%, 50%, and 75%. Room order left to right:
Row 1: peach fitness studio with treadmills, cycles and lockers; amber lounge with leather sofas, potted plants and floor lamps; colorful retro game room with arcade cabinets and pinball machines.
Row 2: golden nuclear reactor with a radiant large steel core, yellow pipes and warning railings; vivid green subterranean garden with grow lights; blue late-game water purification plant with silver tanks and a grated catwalk.
Row 3: a red and chrome cola bottling factory with a continuous conveyor; circular gear-shaped bunker entrance door with steel surround and flanking brass lights; overseer's office with curved mahogany desk, bookcase and green CRTs.
Row 4: teal vintage barbershop with two seats and sinks; an open rocky cavern mouth with ochre ground under pale wasteland sky; dark rough ore-streaked bedrock cutaway.
```

### triple-a

```text
1536×1024 landscape, EXACT 2 columns × 4 equal rows, each room tile 768×256 (3:1). Vertical tile boundary exactly at 50%. Row boundaries exactly 25%, 50%, and 75%. Room order left to right:
Row 1: a warm brown stockroom with shelves, crates, and a loading bay; a purple and amber radio station with recording equipment, console and seating.
Row 2: ochre weight room with weights and lots of exercise equipment; golden obstacle course for agility training with hurdles, mats and cones.
Row 3: olive armory, weapon lockers at left and a wide firing range at right; warm classroom with classroom desks, maps and a large green chalkboard.
Row 4: peach fitness studio with treadmills and exercise cycles; amber community lounge with couches, plants and coffee tables.
```

### triple-b

```text
1536×1024 landscape, EXACT 2 columns × 4 equal rows, each room tile 768×256 (3:1). Vertical tile boundary exactly at 50%. Row boundaries exactly 25%, 50%, and 75%. Room order left to right:
Row 1: vibrant arcade with vintage pinball tables and a colorful jukebox; brightly lit green greenhouse with diverse planter shelves and lamps.
Row 2: industrial blue water purification hall with silver tanks and a light steel catwalk; green and brass weapon workshop with wall weapon racks, shelving, tools and workbenches.
Row 3: handsome garment workshop with fabric racks, sewing machines and dress forms; theme workshop with drafting tables and sketches, shelves of architectural models and tools.
Row 4 left: wide empty dark brown bedrock with shale and mottled warm soil, fill the whole tile and no room walls or ceiling. Row 4 right: pale low-key sky, sparse shrubs and rocky hills across a wide continuous sandy wasteland horizon, with exposed soil beneath, no room walls or ceiling.
```
