# Inside inference — public edition

15 original animated lessons, organized into four chapters. Each film is 80 seconds; the series is 20 minutes.

- Open `index.html` for the self-contained interactive Three.js library, transcripts, and primary sources. Optional Read aloud uses an available voice on your own device; no voice recording is distributed by this page.
- Open `watch.html` for the silent, captioned film series. Keep `videos/` beside it: this public web player loads each MP4 on demand.
- Download an individual MP4 from the player, or use `Inside-inference-15-silent-videos.zip` for all 15 films. Every published MP4 has no audio stream.

The public films retain their original captions and animations; their footer reads SILENT / CAPTIONED. Timing and memory illustrations are teaching schematics, not production measurements. Engine capabilities depend on version, model, and hardware; primary sources are included in each lesson (September 2026 review).

Topics: tokens, prefill, decode and KV caching, quantization, PagedAttention, Ring/FlashAttention, prefix caching and routing, speculative decoding, continuous batching, tensor parallelism, pipeline/data/expert parallelism, prefill/decode disaggregation, SGLang versus vLLM, local Meta/Llama models, and production request handling.

Three.js 0.180.0 is distributed under the MIT license. Its full notice is in `THIRD-PARTY-NOTICES.txt` and embedded in `index.html`.

Deploy this complete directory to a static host. All internal links are relative and work under a GitHub Pages project subdirectory. No backend, credentials, or external runtime assets are required.
