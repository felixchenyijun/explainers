# Organizing time in the Human Atlas

Research and design review: September 2026. This is a comparison of influential approaches, not an exhaustive catalogue of all historical scholarship.

## The decision

Keep absolute dates fixed and let the reader switch interpretive lenses. Default to broad global processes. Offer regional periodizations for Europe, Africa, China, and Mesoamerica. The map and personal lives retain the same chronology when a lens changes.

The atlas begins at 3000 BCE, within the age of early cities, and ends at 2024 CE, the last year in the boundary dataset. It does not pretend that human history begins with states. Prehistory, much older migrations, and deep time require a different scale and are outside this edition.

## Research comparison

| Framework or precedent | What it contributes | How this atlas uses it | Important limit |
| --- | --- | --- | --- |
| [World History for Us All, UCLA](https://whfua.history.ucla.edu/shared/units.php) | Global processes and nested panorama, landscape, and close-up scales | World-era themes, plus full-history, millennium, century, and decade views | Its Big Eras overlap; the atlas uses adjacent navigation bands as an editorial adaptation, not a claim that transitions happened on one date |
| [OER Project, Origins course guide](https://www.oerproject.com/-/media/WHP/PDF/Teacher-Resources/WHP-Origins-Course-Guide-SY21-22.ashx) | Periods are historical interpretations; processes overlap | Era explanations explicitly distinguish the dated axis from its interpretive labels | A teaching framework is not a universally agreed partition of time |
| [The Met, Timeline of Art History](https://www.metmuseum.org/toah) | Geographic comparison, material evidence, and simultaneous cultural histories | Image-rich entries and a China lens; present-day photographs are distinguished from historical objects and later depictions | Art collections are selective, and a museum’s holdings do not measure a society’s importance |
| [UNESCO, General History of Africa](https://www.unesco.org/en/general-history-africa) | African perspectives and a continental chronology organized around indigenous developments as well as outside interactions | Africa lens uses the collection’s broad intervals rather than imposing European medieval/modern divisions | Africa contains many overlapping local histories; continental intervals remain broad |
| [British Museum, Britain and Europe 800 BCE–43 CE](https://www.britishmuseum.org/collection/galleries/britain-and-europe-800-bc-ad-43) | Material cultures and regional Bronze/Iron Age usage | Europe lens includes approximate archaeological ages | Metal technologies and social changes spread at different times; they are not a global ranking of societies |
| [UC Santa Barbara, Mesoamerican Research Center](https://www.marc.ucsb.edu/research/maya/ancient-maya-civilization/preclassic-period) and [The Met, Ancient Americas](https://www.metmuseum.org/de/exhibitions/arts-of-the-ancient-americas/inside-the-exhibition) | Preclassic, Classic, and Postclassic chronologies | A specifically Mesoamerican lens | This chronology does not describe the entire Americas; 1521 is not the end of Indigenous histories |
| [Histography](https://www.histography.io/) | An event field whose density becomes meaningful at different time ranges | Event clusters at broad scales, with finer detail revealed on zoom | Dense dots alone make causal explanation difficult; each point also opens a sourced story |
| [Northwestern Knight Lab, TimelineJS](https://timeline.knightlab.com/docs/index.html) | Illustrated narrative events and adjustable navigation scales | Illustrated event entries and sequential life chapters | A linear slideshow alone is insufficient for a simultaneous global map |
| [Cliopatria / Seshat](https://github.com/Seshat-Global-History-Databank/cliopatria) and [Bennett et al., Scientific Data (2025)](https://doi.org/10.1038/s41597-025-04516-9) | Dated political polygons with documented inclusive FromYear/ToYear intervals | Clickable territories, temporal expansion/contraction, and the political setting of a life chapter | Reconstructed political control is not the same thing as language, identity, influence, or population; coverage and precision are uneven |

## Specific interaction rules

- Dates use BCE/CE with no year zero. The internal continuous index skips zero without adding a gap.
- All history shows only the broadest event tier. A millennium adds regional events; century and decade views include the most specific featured events.
- Nearby points become a dated cluster. Opening it lists each event with its own date. No event is shifted to manufacture visual spacing.
- Labels are distributed across the displayed window and culled for available space. The event list preserves access to every eligible event.
- The selected year stays in view. Previous/next window controls move through equal spans; changing era lenses preserves date and scale.
- Selecting a featured person adds their lifespan and life-chapter markers. Chapter navigation updates the map year and position together.
- People search accepts accents, aliases, and close spellings. It searches 80 featured biographies alongside political entities, events, places, and years. Optional Wikipedia/Wikidata lookup provides further people and birth context without claiming curated life chapters for every person.

## Cartographic sources and transformations

Political geometry: Cliopatria `v0.2.0-duplicate`, CC BY 4.0. The derivative includes only POLITY records, excludes parenthesized aggregate duplicates, clips the temporal range, repairs invalid geometry, simplifies by 0.065 degrees with topology preservation, rounds coordinates, orients rings for D3, and packs shared arcs with TopoJSON quantization. Inclusive source intervals are preserved. Political territories can overlap where the source describes layered rule. Every source interval is available in the territory explorer.

The map's static terrain is [Natural Earth II with shaded relief](https://www.naturalearthdata.com/downloads/50m-raster-data/50m-natural-earth-2/), public domain. It shows idealized vegetation and relief rather than reconstructed annual climate. The rendered palette distinguishes forests, grasslands, arid regions, and highlands/ice. Geographic coastlines are modern reference geometry. Ocean shelves, ridges, and basins use [Natural Earth bathymetry](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-bathymetry/), derived from SRTM Plus. Seven depth contours (200–6,000 m) are simplified and rasterized with the terrain into a compact equirectangular basemap. The sea colors represent static depth, not historical navigation routes or currents.

Editorial corrections are explicitly retained in the data:

1. Corsica, 1769–1793: remove a superseded Genoese coastal overlap after French conquest, using [Fondation Napoléon's account of the early years](https://www.napoleon.org/en/history-of-the-two-empires/timelines/1769-1793-napoleon-bonapartes-early-years/). The existing French geometry is retained.
2. France, 1804: relabel the year's Consulate geometry as First French Empire for the coronation-year view, supported by [The Met's France 1800–1900 chronology](https://www.metmuseum.org/toah/ht/10/euwf.html). Annual resolution cannot distinguish the months before and after the imperial transition.

The 70 editorial civilization entries do not all correspond to bounded states. Where no political geometry is available, the UI says so and retains a location marker; no territory is invented from a capital point. Gaps in the dataset never imply uninhabited land.

## Images and biographies

Photographs and art are cached from Wikimedia Commons only when metadata identifies a reusable public-domain or CC BY/CC BY-SA license. Each image includes its file page, author, license, and an enlargement with full credit. Images are resized and converted to WebP. Place photographs and later portraits are context, not reconstructions of the selected year. Encyclopedia extracts retain article links and CC BY-SA attribution. Original short life chapters and event descriptions distinguish broad processes, approximate dates, and disputed ancient details.

A portrayed individual may be known only through a much later artistic depiction. A fallback monogram is used when a suitable licensed image is unavailable. Lifespan dates are approximate where indicated. A final legacy marker explicitly identifies its location as the last featured place when the death location is not separately established.
