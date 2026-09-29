// Original educational scripts. Geometry and timing illustrate mechanisms, not benchmarks.
export const lessons = [
  {
    id: 'token', group: 0, title: 'One token at a time',
    subtitle: 'A language model turns a sequence of token IDs into a distribution over the next token.', duration: 80,
    control: { label: 'Sampling temperature', min: 0, max: 1, step: 0.01, value: 0.35, low: 'Sharper', high: 'Flatter' },
    acts: [
      { title: 'Text becomes coordinates', narration: 'Start with a sentence. The tokenizer breaks it into vocabulary pieces: sometimes whole words, sometimes fragments, sometimes bytes. Each piece becomes an integer ID. A learned embedding turns that ID into a vector. The model now has a sequence of numerical representations, with information about their positions.', equation: 'text → token IDs → vectors', insight: 'A token is a vocabulary unit, not necessarily a word.' },
      { title: 'Context changes the vector', narration: 'Inside each transformer layer, attention lets a position gather information from earlier positions. A query is compared with keys, and the resulting weights mix value vectors. Feedforward layers then transform each position. Residual connections carry information forward. Repeating these operations builds a representation shaped by the entire visible context.', equation: 'Attention(Q,K,V) = softmax(QKᵀ / √d + mask)V', insight: 'The causal mask prevents a position from reading future tokens.' },
      { title: 'A distribution, not a sentence', narration: 'At the final position, a projection produces one score for each vocabulary entry. These scores are logits. Softmax converts them into probabilities. Move the temperature control: lower temperature concentrates probability on the largest scores, while higher temperature spreads it out. This changes sampling, without changing the trained model weights.', equation: 'T > 0: p(i) = exp(zᵢ/T) / Σⱼ exp(zⱼ/T)', insight: 'Temperature changes sampling; zero conventionally selects greedy decoding.' },
      { title: 'Close the loop', narration: 'Choose a token from that distribution, append it to the sequence, and repeat. Each choice changes the context for the next choice. That dependency is why ordinary generation cannot produce every future token in a single parallel pass. The moving blocks are a conceptual view of this numerical loop.', equation: 'p(x₁…xₙ) = ∏ₜ p(xₜ | x₁…xₜ₋₁)', insight: 'A long answer is a chain of conditional predictions.' },
    ],
    deepDive: [
      'An embedding is a learned lookup table; contextual hidden states are the vectors produced after transformer layers. Do not confuse either with the model parameters themselves. The parameters stay fixed during ordinary inference, while hidden states change for each request.',
      'Greedy decoding chooses the largest logit. Random sampling, top-k, and top-p apply different selection rules to the same underlying scores. A lower temperature does not supply new knowledge. The animation shows a small invented vocabulary, so its probabilities are illustrative rather than model measurements.',
    ],
    sources: [
      { label: 'Transformer architecture — original paper', url: 'https://arxiv.org/abs/1706.03762' },
      { label: 'Hugging Face — tokenization pipeline', url: 'https://www.huggingface.co/docs/tokenizers/python/latest/pipeline.html' },
      { label: 'Hugging Face — generation parameters', url: 'https://huggingface.co/docs/transformers/main_classes/text_generation' },
    ],
  },
  {
    id: 'prefill', group: 0, title: 'Prefill: reading the prompt',
    subtitle: 'Known prompt tokens can be processed together before the first generated token appears.', duration: 80,
    control: { label: 'Prompt length', min: 0, max: 1, step: 0.01, value: 0.45, low: 'Short prompt', high: 'Long prompt' },
    acts: [
      { title: 'All the inputs already exist', narration: 'A user sends a prompt containing many tokens. Unlike future output tokens, these inputs are already known. Within a layer, their projections and feedforward operations can run together as matrix operations. Layers still depend on previous layers, and causal attention still restricts which earlier positions each token can inspect.', equation: 'known prompt: x₁, x₂, …, xₙ', insight: 'Parallel prompt processing does not remove the causal mask.' },
      { title: 'Build the reusable state', narration: 'As the prompt moves through the layers, each layer produces keys and values for its tokens. Store them in the KV cache. Think of this as preparing an indexed notebook that future tokens can consult. The notebook contains intermediate attention data, rather than a copy of the final answer.', equation: 'prefill → per-layer K and V for prompt positions', insight: 'Prefill initializes the state that decoding will repeatedly read.' },
      { title: 'The first token is the handoff', narration: 'The final prompt position also produces logits for the first generated token. Sampling from those logits begins the answer. Time to first token includes more than GPU work: a request may wait in a queue, undergo tokenization, or travel across a network before the user sees that first result.', equation: 'TTFT ≈ queue + input work + prefill + delivery', insight: 'The first output token is available from the completed prompt pass.' },
      { title: 'Longer prompts reshape the work', narration: 'Increase the prompt length and watch more positions enter together. Dense attention compares many position pairs, while feedforward work grows with the number of tokens. Large prompt matrices often use accelerator compute efficiently. But tiny prompts, enormous contexts, or different hardware can change the bottleneck; this is a mechanism sketch.', equation: 'dense attention pairs ≈ n(n + 1) / 2', insight: 'Prefill is often compute intensive, but its bottleneck depends on the workload.' },
    ],
    deepDive: [
      'For a decoder-only transformer with full causal attention, tokenwise projections and MLP work scale linearly with prompt length; attention work includes a quadratic term. Memory-efficient attention kernels avoid materializing the full score matrix but do not eliminate the dense pairwise arithmetic.',
      'A cache hit can skip computation for an already processed prefix. Chunked prefill can split a new prompt across scheduler iterations. Neither changes the requirement that the first output distribution must account for the full intended prompt. These are scheduling and reuse decisions around the same computation.',
    ],
    sources: [
      { label: 'Efficiently Scaling Transformer Inference', url: 'https://arxiv.org/abs/2211.05102' },
      { label: 'SARATHI — prefill and decode work', url: 'https://arxiv.org/abs/2308.16369' },
      { label: 'FlashAttention — memory traffic during attention', url: 'https://arxiv.org/abs/2205.14135' },
    ],
  },
  {
    id: 'decode', group: 0, title: 'Decode: the memory treadmill',
    subtitle: 'Each new token reuses old keys and values, but still has to read the relevant context.', duration: 80,
    control: { label: 'Cached context length', min: 0, max: 1, step: 0.01, value: 0.4, low: 'Short context', high: 'Long context' },
    acts: [
      { title: 'Only one position is new', narration: 'After prefill, feed the newly generated token through the model. Each layer calculates a fresh query, key, and value for that position. Append its key and value to the cache. Attention reads both earlier positions and this current position. Continue through the remaining layers, then predict another output token.', equation: 'K ← [K; kₜ]   V ← [V; vₜ]', insight: 'KV caching avoids recomputing old projections and hidden states.' },
      { title: 'Reuse still requires reads', narration: 'The old context is cached, but attention must still access its relevant contents. Model weights must also reach the compute units. With small batches, there may be too little arithmetic per transferred byte to keep those units busy. More arithmetic capacity alone cannot fix a workload limited by memory bandwidth.', equation: 'time ≥ max(compute / FLOP rate, bytes / bandwidth)', insight: 'Caching removes repeated computation, not the cost of reading cached data.' },
      { title: 'Count the cache', narration: 'Count two tensors, keys and values, for every layer, token, KV head, and head dimension. With thirty-two layers, eight KV heads, width one hundred twenty-eight, and two-byte BF16 values, each cached token needs one hundred twenty-eight kibibytes. This is a worked example, not a universal model specification.', equation: 'KV bytes = 2 × L × T × Hkv × D × bytes/value', insight: 'Example: 2 × 32 × 8 × 128 × 2 = 131,072 bytes per token.' },
      { title: 'Context competes with concurrency', narration: 'Turn up the context length: each request occupies more memory and brings more attention reads. The same GPU can then hold fewer simultaneous requests. Grouped-query attention reduces the number of distinct KV heads shared by query heads. It changes the architecture so that this growing cache is smaller.', equation: 'example: 8,192 tokens × 128 KiB = 1 GiB', insight: 'Long context consumes capacity even when the model weights fit comfortably.' },
    ],
    deepDive: [
      'The formula assumes full attention, uniform layer shapes, uncompressed K/V, and no padding or allocator overhead. Multiply by concurrent sequences for an unshared cache. Sliding-window layers, prefix sharing, quantized KV, sharding, and latent-attention architectures require different accounting.',
      'GQA gives several query heads one shared KV head; MQA is the extreme with a single KV head. Weight quantization and KV quantization are separate choices. Increasing batch size amortizes weight reads across tokens, so large-batch decode can become compute limited even when single-request decode is bandwidth limited.',
    ],
    sources: [
      { label: 'Hugging Face — cache strategies', url: 'https://huggingface.co/docs/transformers/kv_cache' },
      { label: 'GQA — grouped-query attention', url: 'https://arxiv.org/abs/2305.13245' },
      { label: 'Efficiently Scaling Transformer Inference', url: 'https://arxiv.org/abs/2211.05102' },
    ],
  },
  {
    id: 'quantization', group: 0, title: 'Quantization: fewer bits',
    subtitle: 'Reducing numerical precision saves memory while trading rounding error against hardware efficiency.', duration: 80,
    control: { label: 'Weight precision', min: 0, max: 1, step: 0.01, value: 0.35, low: '4-bit', high: '16-bit' },
    acts: [
      { title: 'Weights are numbers', narration: 'A model checkpoint is mostly arrays of learned numbers. Storing each number with fewer bits reduces the space those arrays occupy. Move the precision control and watch the available numerical levels change. The model keeps its overall architecture; quantization changes how its values are represented and used during computation.', equation: 'ideal weight bytes = parameter count × bits / 8', insight: 'Quantization compresses numerical representation rather than removing every fourth layer.' },
      { title: 'A ruler with fewer marks', narration: 'Imagine replacing a finely marked ruler with a coarser one. A simple quantizer rounds values to nearby levels, using scales and sometimes offsets to reconstruct an approximation. Different groups of weights can have different scales. Four bits allow sixteen code values, but useful formats need more than that simple count.', equation: 'q = round(w / s)   ŵ = s × q', insight: 'Scale metadata and rounding error are part of the representation.' },
      { title: 'Protect the useful signal', narration: 'Some directions in a network are more sensitive to error than others. Calibration uses representative inputs to guide the conversion. AWQ adjusts scaling using activation information; GPTQ compensates for quantization error using an approximation to second-order structure. Neither makes every model, task, and low-bit format equally reliable.', equation: 'quality depends on format + calibration + model + task', insight: 'Evaluate the actual workload after changing precision.' },
      { title: 'Storage is not total memory', narration: 'For an idealized eight-billion-parameter model, sixteen-bit weights occupy sixteen decimal gigabytes; four-bit weights occupy four. Real allocations also include scales, unquantized tensors, KV cache, and temporary buffers. Faster inference additionally requires suitable kernels. Saving four times the weight bytes does not guarantee four times the generation speed.', equation: '8B × 16/8 = 16 GB;  8B × 4/8 = 4 GB', insight: 'Weight memory is only one term in the runtime memory budget.' },
    ],
    deepDive: [
      'Weight-only schemes may store weights at 4 bits while calculating with higher-precision activations. Other schemes quantize both weights and activations. SmoothQuant redistributes activation outliers through an equivalent rescaling before quantization. KV-cache precision is a third, independent memory decision.',
      'The memory arithmetic here uses exactly 8 billion parameters and decimal GB, excludes metadata, and is an estimate. Lower precision can save bandwidth yet introduce dequantization overhead. Hardware instruction support, packing, batch size, and model shape determine whether a smaller checkpoint also runs faster.',
    ],
    sources: [
      { label: 'AWQ — activation-aware weight quantization', url: 'https://arxiv.org/abs/2306.00978' },
      { label: 'GPTQ — post-training weight quantization', url: 'https://arxiv.org/abs/2210.17323' },
      { label: 'SmoothQuant — weights and activations', url: 'https://arxiv.org/abs/2211.10438' },
    ],
  },
  {
    id: 'paging', group: 1, title: 'PagedAttention: a place for every token',
    subtitle: 'Fixed-size KV blocks let growing requests share a memory pool without requiring contiguous space.', duration: 80,
    control: { label: 'Allocated KV blocks', min: 0, max: 1, step: 0.01, value: 0.45, low: 'Few blocks', high: 'Many blocks' },
    acts: [
      { title: 'The growing-shelf problem', narration: 'Suppose each request needs a shelf for its future KV cache. Reserving one huge contiguous shelf wastes space when the answer ends early. Reserving too little makes growth awkward. Real workloads mix short and long conversations, so the gaps between allocations can become as important as the useful data.', equation: 'allocated capacity = useful tokens + unused slots', insight: 'Memory layout can limit concurrency before arithmetic becomes the problem.' },
      { title: 'Split the shelf into blocks', narration: 'Instead, split each request into fixed-size logical blocks. A block table maps them to physical blocks anywhere in a common memory pool. Logical neighbors need not be physical neighbors. The attention kernel follows this mapping when it reads keys and values, preserving the token order seen by the model.', equation: 'logical block i → block_table[i] → physical KV block', insight: 'PagedAttention combines a block layout with a kernel that understands it.' },
      { title: 'Grow and reclaim', narration: 'As another token arrives, use the next free slot in the last block. When that block fills, allocate another. When a request finishes, release its blocks for reuse. Turn up the allocation control to watch scattered physical locations support many growing sequences without moving their entire caches around.', equation: 'blocks needed = ceil(tokens / tokens_per_block)', insight: 'The final partial block still wastes some slots; paging does not make overhead zero.' },
      { title: 'Share only what is identical', narration: 'If multiple sequences share an identical computed prefix, their block tables can point at the same physical blocks. Reference counts track ownership. A shared block that needs independent modification requires a separate copy. This supports efficient branching and reuse while keeping each sequence’s changing continuation separate from the others.', equation: 'shared prefix blocks + private continuation blocks', insight: 'Paging manages placement; prefix caching decides which computed state is reusable.' },
    ],
    deepDive: [
      'The analogy is to virtual memory, but KV blocks are managed by the inference runtime. PagedAttention does not inherently mean swapping to disk, and it does not reduce the number of positions required by exact full attention. It mainly reduces allocation waste and enables flexible sharing.',
      'Block size trades off internal fragmentation against metadata and kernel efficiency. Reference counting and copy-on-write preserve shared prefixes safely. A finished request may release its ownership while a prefix cache retains reusable blocks; eviction policy decides when those retained blocks become available for something else.',
    ],
    sources: [
      { label: 'PagedAttention — original vLLM paper', url: 'https://arxiv.org/abs/2309.06180' },
      { label: 'vLLM — paged attention kernel', url: 'https://docs.vllm.ai/en/latest/design/paged_attention/' },
      { label: 'vLLM — prefix block lifecycle', url: 'https://docs.vllm.ai/en/latest/design/prefix_caching/' },
    ],
  },
  {
    id: 'ring', group: 1, title: 'Ring attention: move the context',
    subtitle: 'Context parallelism distributes a long sequence across devices while attention combines every required shard.', duration: 80,
    control: { label: 'Context shards in use', min: 0, max: 1, step: 0.01, value: 0.65, low: 'Short context', high: 'All four shards' },
    acts: [
      { title: 'One context, several devices', narration: 'A very long sequence can exceed one device’s activation memory. Split its positions across several devices. Each device owns a portion of the queries and corresponding state. To calculate full attention, those queries still need information from all relevant key and value positions, including positions stored on other devices.', equation: 'sequence = shard₀ ∪ shard₁ ∪ shard₂ ∪ shard₃', insight: 'Splitting the context differs from splitting the model weights.' },
      { title: 'Pass the blocks around', narration: 'Arrange the devices in a ring. Each processes its current key-value block, then sends that block to a neighbor while receiving another. Query positions stay with their owner as remote context passes by. Where the computation is large enough, communication can overlap with useful attention work on the current block.', equation: 'local queries × circulating K/V blocks', insight: 'A ring is a communication schedule, not an eviction rule for old tokens.' },
      { title: 'Combine without a giant matrix', narration: 'Attention uses a softmax over all visible keys. You cannot normalize each shard independently and simply add the answers. Blockwise algorithms maintain running maxima, normalization sums, and weighted outputs so the pieces combine correctly. Causal masking still applies, and floating-point roundoff can differ from another execution order.', equation: 'global output = correctly normalized sum of block contributions', insight: 'Exact attention requires a global normalization across the participating blocks.' },
      { title: 'Three different memory problems', narration: 'FlashAttention reduces traffic between a GPU’s large memory and its fast on-chip storage. PagedAttention organizes the persistent KV allocation. Ring attention distributes sequence computation across devices. These techniques address different boundaries and can be combined. The rotating scene illustrates long-context work; it does not promise faster single-token decoding.', equation: 'Flash: on-device IO   Paged: allocation   Ring: devices', insight: 'Ring attention is useful only when its communication cost is justified.' },
    ],
    deepDive: [
      'The original Ring Attention work combines blockwise attention and feedforward computation to spread long sequences over devices. Communication hiding requires sufficiently large blocks and suitable interconnects. Tiny blocks or latency-sensitive decode may expose communication instead of hiding it.',
      'FlashAttention computes dense attention without writing the full score matrix to high-bandwidth memory. It preserves the mathematical operation, up to floating-point effects. Context-parallel decode implementations may distribute KV and combine partial attention results with collectives rather than literally use the same ring schedule shown here.',
    ],
    sources: [
      { label: 'Ring Attention — original paper', url: 'https://arxiv.org/abs/2310.01889' },
      { label: 'Ring Attention — reference implementation', url: 'https://github.com/haoliuhl/ringattention' },
      { label: 'FlashAttention — IO-aware exact attention', url: 'https://arxiv.org/abs/2205.14135' },
    ],
  },
  {
    id: 'prefix', group: 1, title: 'Prefix caching & routing',
    subtitle: 'Identical beginnings can reuse computation, but the nearest cache is not always the fastest destination.', duration: 80,
    control: { label: 'Shared prompt prefix', min: 0, max: 1, step: 0.01, value: 0.6, low: 'No overlap', high: 'Mostly shared' },
    acts: [
      { title: 'Different questions, same beginning', narration: 'Two requests may begin with the same system instructions, document, or conversation history. In a causal transformer, the computed state of that exact prefix does not depend on the later question. Preserve its keys and values, then process only the new suffix when a matching request arrives later.', equation: 'prompt = reusable prefix + new suffix', insight: 'Prefix caching saves repeated prefill work; it does not cache a completed answer.' },
      { title: 'Match computation, not appearance', narration: 'Similar-looking text is insufficient. Reuse requires the same effective token prefix under a compatible model, adapter, position setup, and other inputs that affect computation. A shared phrase after a different beginning generally has different keys and values. The cache key must represent the conditions that made those values.', equation: 'same tokens + same computational context → reusable state', insight: 'An identical substring is not necessarily an identical computed prefix.' },
      { title: 'Route toward useful state', narration: 'Now place several replicas behind a router. One worker already holds the shared prefix; another does not. Sending the request to the warm worker can avoid prompt computation. A cache-aware router tracks which workers hold useful blocks and compares this benefit against the work already queued on each worker.', equation: 'estimated cost = waiting + uncached work + transfer', insight: 'Routing turns cache locality into a fleet-level scheduling decision.' },
      { title: 'A warm worker can be too busy', narration: 'Increase prefix overlap and the reusable branch becomes more valuable. But imagine that worker also has a long queue. An idle worker that recomputes the prompt may finish sooner. Practical routing balances reuse, load, and capacity, while cache eviction keeps rarely reused prefixes from crowding out active conversations.', equation: 'saved prefill time must outweigh added waiting', insight: 'Maximizing cache hit rate alone does not minimize user latency.' },
    ],
    deepDive: [
      'Hash chains can identify token blocks together with the prefix before them; radix trees organize shared paths explicitly. Model identity, LoRA adapters, multimodal inputs, and isolation domains may affect validity. Tenant isolation can deliberately prevent sharing across otherwise matching requests.',
      'A cache hit changes prompt cost, not necessarily decode cost: future tokens still attend to the retained context. Cache locality information can be stale, and moving a cache can cost more than recomputing it. The illustrated cost expression is a design intuition, not a specific router’s measured formula.',
    ],
    sources: [
      { label: 'Hugging Face — reusing a prefilled cache', url: 'https://huggingface.co/docs/transformers/main/kv_cache' },
      { label: 'vLLM — cache identity and isolation', url: 'https://docs.vllm.ai/en/latest/design/prefix_caching/' },
      { label: 'NVIDIA Dynamo — KV-aware routing', url: 'https://docs.dynamo.nvidia.com/dynamo/dev/knowledge-base/concepts/system-architecture/kv-aware-routing' },
    ],
  },
  {
    id: 'speculation', group: 1, title: 'Speculative decoding',
    subtitle: 'A cheap proposer guesses ahead, and an exact verifier accepts useful work without changing the target distribution.', duration: 80,
    control: { label: 'Accepted draft prefix', min: 0, max: 1, step: 0.01, value: 0.65, low: 'Few accepted', high: 'Many accepted' },
    acts: [
      { title: 'Guess several steps ahead', narration: 'Ordinary decoding asks the large model to produce one token per step. A smaller draft model can instead propose several tokens cheaply. Those guesses form a candidate continuation. The target model processes that known candidate sequence together, obtaining the conditional probabilities needed to check each proposed position in one pass.', equation: 'draft q proposes k tokens → target p verifies', insight: 'Verification can parallelize known candidates even though drafting remains sequential.' },
      { title: 'Accept with the right probability', narration: 'For exact speculative sampling, a proposed token is accepted with probability equal to the smaller of one and target probability divided by draft probability. This corrects for the draft model’s preferences. The check proceeds from left to right, because a later candidate is meaningful only while its earlier context survives.', equation: 'accept x with probability min(1, p(x) / q(x))', insight: 'Acceptance is a probability-ratio test, not a vague similarity check.' },
      { title: 'Repair the first rejection', narration: 'At the first rejection, discard that candidate and everything after it. Sample a replacement from the normalized positive part of target probability minus draft probability. If every proposal is accepted, sample a bonus token from the target’s next distribution. This correction is what preserves the target sampling distribution.', equation: 'on rejection: r(x) ∝ max(0, p(x) − q(x))', insight: 'Simply replacing a rejected token with an ordinary target sample is not this exact algorithm.' },
      { title: 'Speed depends on useful guesses', narration: 'Move the acceptance control. When many candidates survive, one expensive verification advances the answer several tokens. When few survive, drafting and verification overhead can erase the gain. Exactness refers to the output distribution under the algorithm’s assumptions; it does not require matching the same random-seed transcript of another implementation.', equation: 'benefit depends on accepted tokens / total draft-and-verify time', insight: 'Greedy verification uses target argmax matches; stochastic verification needs correction.' },
    ],
    deepDive: [
      'At each accepted position, p and q are conditioned on the same accepted prefix. If the target assigns a proposed token more probability than the draft, it is always accepted; otherwise acceptance thins out the draft’s excess mass. The residual distribution supplies the missing target mass.',
      'The scene illustrates classical draft-model speculative sampling. Modern systems may use n-grams, learned prediction heads, or tree-shaped proposals with different verification details. Draft cost, acceptance length, batch size, and target utilization determine speed; exact verification does not guarantee a speedup for every workload.',
    ],
    sources: [
      { label: 'Fast Inference from Transformers via Speculative Decoding', url: 'https://arxiv.org/abs/2211.17192' },
      { label: 'Accelerating Large Language Model Decoding with Speculative Sampling', url: 'https://arxiv.org/abs/2302.01318' },
      { label: 'vLLM — speculative decoding', url: 'https://docs.vllm.ai/en/stable/features/speculative_decoding/' },
    ],
  },
  {
    id: 'batching', group: 2, title: 'Batching: keep the seats moving',
    subtitle: 'A serving engine continuously combines requests while balancing prompt work against smooth token delivery.', duration: 80,
    control: { label: 'Concurrent requests', min: 0, max: 1, step: 0.01, value: 0.5, low: 'Light load', high: 'Heavy load' },
    acts: [
      { title: 'Share one weight read', narration: 'Several users can run through the same model together. A matrix operation applies shared weights to multiple token vectors, amortizing memory traffic and using more accelerator capacity. Each request still has its own context and output. A batch is a way of executing independent work together, not mixing the users’ conversations.', equation: 'shared W × [request A; request B; request C]', insight: 'Batching improves utilization while preserving each request’s separate state.' },
      { title: 'Replace finished requests immediately', narration: 'In a fixed batch, a short answer may finish while a long answer keeps the remaining slots occupied. Continuous batching rebuilds the active set between generation iterations. Finished requests leave, waiting requests enter, and others continue. The scheduler keeps the expensive model occupied with useful work as request lengths diverge.', equation: 'iteration t: A B C   →   iteration t+1: A D C', insight: 'The scheduling unit is an iteration rather than an entire completed batch.' },
      { title: 'Cut a long prefill into chunks', narration: 'A new long prompt can consume enough time to interrupt existing token streams. Chunked prefill divides that prompt’s work across iterations. A scheduler can mix prompt chunks with decode tokens under a token budget. This reduces long stalls for active users, though the new request may wait longer for its first token.', equation: 'iteration budget = decode tokens + prefill chunk tokens', insight: 'Chunking changes when prompt work runs, not the prompt’s causal meaning.' },
      { title: 'Throughput is not the whole objective', narration: 'Increase the incoming load. Larger batches can improve throughput, but queues and longer iterations can hurt perceived responsiveness. Operators balance time to first token, inter-token latency, total completion time, and memory capacity. Admission limits and fair scheduling matter when there is more demand than the fleet can serve promptly.', equation: 'goodput = requests meeting the latency target per second', insight: 'The best batch policy depends on the service’s latency goals.' },
    ],
    deepDive: [
      'Orca established iteration-level scheduling for generative serving. Chunked-prefill systems such as Sarathi extend the scheduling toolbox by controlling how much new prompt work enters an iteration. Token budgets and KV capacity both constrain the batch; a count of requests alone does not describe its cost.',
      'An interactive chat service and an offline summarization job can prefer different policies on identical GPUs. Throughput measures completed work; goodput counts work satisfying specified latency objectives. The visual slots represent scheduler opportunities rather than literal, permanently reserved hardware lanes.',
    ],
    sources: [
      { label: 'Orca — iteration-level scheduling', url: 'https://www.usenix.org/conference/osdi22/presentation/yu' },
      { label: 'Sarathi-Serve — throughput and latency', url: 'https://arxiv.org/abs/2403.02310' },
      { label: 'vLLM — optimization and tuning', url: 'https://docs.vllm.ai/en/latest/configuration/optimization/' },
    ],
  },
  {
    id: 'tensor', group: 2, title: 'Tensor parallelism',
    subtitle: 'Several GPUs cooperate on pieces of the same layer, exchanging results to preserve one model computation.', duration: 80,
    control: { label: 'Tensor shards', min: 0, max: 1, step: 0.01, value: 0.5, low: '2 GPUs', high: '4 GPUs' },
    acts: [
      { title: 'Cut a matrix, not a request', narration: 'A layer contains large weight matrices. Tensor parallelism divides those matrices among devices so that several GPUs collaborate on one layer of one model replica. Each holds only part of the weights. The input is replicated or partitioned as required by the operation, and every shard contributes to the result.', equation: 'W = [W₀ W₁ … Wₚ₋₁]', insight: 'Tensor-parallel GPUs work together on the same model execution.' },
      { title: 'Choose a useful split', narration: 'With a column split, each GPU computes a different part of the output vector. With a row split, each computes a partial contribution that must be summed. Transformer implementations pair compatible splits across adjacent operations to avoid unnecessary exchanges. Attention heads and feedforward dimensions offer natural places to divide work.', equation: 'row split: y = x₀W₀ + x₁W₁ + …', insight: 'The matrix partition determines whether outputs need concatenation or reduction.' },
      { title: 'Pay for the collective', narration: 'Communication makes the partial results usable by the next operation. An all-reduce sums contributions and gives the result to every participant. All-gather concatenates shards, while reduce-scatter leaves a reduced shard on each device. These are numerical collectives whose cost depends strongly on the size and speed of the interconnect.', equation: 'all-reduce: each GPU receives Σᵣ partial_resultᵣ', insight: 'Communication is part of the layer’s latency, not free background work.' },
      { title: 'More shards have a ceiling', narration: 'Increase the shard count. Each GPU stores and computes less, but coordination does not disappear. Eventually smaller local operations and collective latency can dominate. Tensor parallelism is valuable for fitting a model or meeting latency goals; adding more independent replicas may be better when the goal is serving more users.', equation: 'layer time ≈ local compute + exposed communication', insight: 'More GPUs do not automatically mean lower latency per token.' },
    ],
    deepDive: [
      'Megatron-style tensor parallelism is an established intra-layer partitioning pattern. Biases, normalization, activation functions, attention shapes, and sharded vocabulary outputs affect where communication belongs. A naïve rule that divides every tensor independently can add extra collectives or produce incorrect results.',
      'Fast links inside a node often make tensor parallelism attractive there. Across slower links, pipeline parallelism or more complete replicas may be preferable. GQA KV heads sometimes replicate across tensor ranks when the rank count exceeds their natural partitioning; memory does not always fall exactly as 1/p.',
    ],
    sources: [
      { label: 'Megatron-LM — intra-layer model parallelism', url: 'https://arxiv.org/abs/1909.08053' },
      { label: 'NVIDIA NCCL — collective operations', url: 'https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html' },
      { label: 'vLLM — parallelism and scaling', url: 'https://docs.vllm.ai/en/latest/serving/parallelism_scaling/' },
    ],
  },
  {
    id: 'pipeline', group: 2, title: 'Pipeline, data & expert parallelism',
    subtitle: 'Different parallelism strategies divide layers, requests, or experts, and can be combined.', duration: 80,
    control: { label: 'Pipeline microbatches', min: 0, max: 1, step: 0.01, value: 0.5, low: 'One in flight', high: 'Many in flight' },
    acts: [
      { title: 'Put layers on an assembly line', narration: 'Pipeline parallelism places one group of model layers on each stage. A token’s hidden state travels through those stages in order. Each device stores the weights for its own layers. This spreads the model across memory pools, but a single token still depends on every stage before its prediction is complete.', equation: 'layers 1–8 → 9–16 → 17–24 → 25–32', insight: 'Pipeline parallelism partitions depth rather than splitting each layer’s matrices.' },
      { title: 'Fill the empty time', narration: 'With only one item moving through the pipeline, most stages wait. Send multiple independent microbatches through so different stages work at once. Increase the control and watch those gaps shrink. Startup, drain, and uneven stage times still create bubbles. One request’s next output token must still wait for its previous prediction.', equation: 'ideal forward utilization ≈ m / (m + p − 1)', insight: 'The formula assumes m microbatches and p equally timed stages.' },
      { title: 'Copy the model for more users', narration: 'Data parallel inference takes a different direction: run multiple model replicas and send different requests to each. A replica may itself use tensor and pipeline parallelism. This raises serving capacity without requiring the independent replicas to combine every layer’s activations. A router decides where each request should run.', equation: 'fleet = replicas × GPUs required per replica', insight: 'Inference data parallelism distributes requests; training data parallelism also synchronizes gradients.' },
      { title: 'Send tokens to selected experts', narration: 'A mixture-of-experts model has several alternative feedforward experts. Its learned router selects a small subset for each token. Expert parallelism places those experts on different devices, dispatches token activations to the selected owners, then combines their outputs. Uneven routing can overload popular experts, making communication and load balancing central concerns.', equation: 'MoE output = Σ selected routing weights × expert outputs', insight: 'Expert parallelism requires an MoE architecture; it is not a switch for any dense model.' },
    ],
    deepDive: [
      'The pipeline animation is a forward-inference schedule; GPipe’s original paper also handles training and backpropagation. The ideal utilization expression ignores communication and assumes equal stage times. More microbatches can fill stages yet increase queueing, so maximum utilization is not identical to minimum interactive latency.',
      'These axes compose: tensor parallelism within a stage, pipeline parallelism across stages, and data parallelism across complete replicas. Context parallelism partitions sequence state; expert parallelism partitions MoE experts. In MoE serving, total parameters, active parameters per token, resident memory, and communication are distinct quantities.',
    ],
    sources: [
      { label: 'GPipe — pipeline and microbatching foundations', url: 'https://arxiv.org/abs/1811.06965' },
      { label: 'vLLM — parallelism and scaling', url: 'https://docs.vllm.ai/en/latest/serving/parallelism_scaling/' },
      { label: 'vLLM — expert parallel deployment', url: 'https://docs.vllm.ai/en/latest/serving/expert_parallel_deployment/' },
    ],
  },
  {
    id: 'disaggregation', group: 2, title: 'Disaggregating prefill & decode',
    subtitle: 'Separate worker pools can optimize the two inference phases, provided the KV handoff is worth its cost.', duration: 80,
    control: { label: 'KV transfer pressure', min: 0, max: 1, step: 0.01, value: 0.4, low: 'Easy handoff', high: 'Network limited' },
    acts: [
      { title: 'Two phases share one machine', narration: 'In a colocated deployment, the same workers handle new prompts and ongoing token streams. Those phases can want different batch sizes and resource balances. A large prefill may interfere with smooth decoding, while a decode-heavy period can leave compute underused. Scheduling helps, but the two workloads still share the same resources.', equation: 'colocated worker: prefill work + decode work', insight: 'Disaggregation addresses interference and resource allocation between inference phases.' },
      { title: 'Specialize the worker pools', narration: 'Create one pool for prompt processing and another for decoding. Prefill workers focus on finishing prompt computation; decode workers focus on continuing active answers. The pools can scale independently and use different parallelism choices. A request now moves through both pools, so coordinating its transition becomes part of the serving system.', equation: 'request → prefill pool → decode pool → streamed answer', insight: 'The same model computation is split across time and workers.' },
      { title: 'The handoff is a tensor transfer', narration: 'The decode worker needs the prompt’s keys and values for all relevant layers. Sending the prompt text alone would force it to recompute prefill. Transfer the cache instead, with compatible layouts and model versions. Increase transfer pressure: a larger cache or slower effective link can delay the start of smooth decoding.', equation: 'transfer time ≥ KV bytes / effective network bandwidth', insight: 'KV transfer can become the new bottleneck after compute interference is removed.' },
      { title: 'Choose the split for the workload', narration: 'Separate pools can help meet distinct first-token and inter-token latency targets. They also introduce transfer, coordination, and potentially extra queueing. Short prompts or modest traffic may work well on colocated workers. Long prompts and strict service goals can justify specialization when the network and cache-transfer system support the handoff.', equation: 'benefit = less interference − transfer and coordination cost', insight: 'Disaggregation is a tradeoff to evaluate, not a universal upgrade.' },
    ],
    deepDive: [
      'DistServe separates prefill and decoding to optimize latency-constrained goodput. A deployment must decide how many workers of each type to provision, how to partition the model, and where to place them. Changing those choices can move the bottleneck among compute, memory, and the network.',
      'The KV transfer formula is a lower bound: bandwidth is shared, metadata and layouts add work, and transfers may overlap computation. Some systems stream cache blocks layer by layer or use external cache tiers. The animation shows a simplified complete handoff, not a trace of a particular connector.',
    ],
    sources: [
      { label: 'DistServe — disaggregating prefill and decoding', url: 'https://arxiv.org/abs/2401.09670' },
      { label: 'vLLM — disaggregated prefilling', url: 'https://docs.vllm.ai/en/latest/features/disagg_prefill/' },
      { label: 'Mooncake — KV-centric disaggregated serving', url: 'https://arxiv.org/abs/2407.00079' },
    ],
  },
  {
    id: 'engines', group: 3, title: 'SGLang & vLLM: why both exist',
    subtitle: 'Two serving engines grew from different research ideas and now overlap across many production capabilities.', duration: 80,
    control: { label: 'Workload prefix reuse', min: 0, max: 1, step: 0.01, value: 0.65, low: 'Independent prompts', high: 'Shared prefixes' },
    acts: [
      { title: 'A model needs a runtime', narration: 'The checkpoint supplies weights, not a complete multiuser service. A serving engine tokenizes inputs, manages requests and KV memory, forms batches, launches kernels, and streams results. vLLM and SGLang both fill this role. The model’s mathematical prediction can be the same while the systems arrange its execution differently.', equation: 'weights + scheduler + cache manager + kernels = serving engine', insight: 'An inference engine is the machinery around executing a trained model.' },
      { title: 'Two starting ideas', narration: 'vLLM’s original work centered on PagedAttention: flexible KV allocation that made larger, more efficient batches possible. SGLang’s original work paired a language for structured generation programs with a runtime using RadixAttention to reuse shared prefixes. Those origins explain their emphasis, but they do not freeze either project’s present feature set.', equation: 'vLLM origin: paged KV   SGLang origin: programs + radix reuse', insight: 'A research origin is a useful explanation, not a permanent capability boundary.' },
      { title: 'Overlap is the current reality', narration: 'Both projects support capabilities such as continuous batching, prefix reuse, quantization, and distributed execution, with details depending on version, hardware, and model. SGLang’s tree emphasizes common prompt paths; vLLM’s prefix cache can identify reusable blocks with hashes. Both approaches can avoid repeated prompt computation when the required state matches.', equation: 'shared prefix → reuse possible in either engine', insight: '“SGLang caches; vLLM does not” is an incorrect comparison.' },
      { title: 'Compare a workload, not a logo', narration: 'Increase shared-prefix traffic to see why cache behavior matters. Then imagine different model architectures, context lengths, hardware, and latency targets. These change which scheduler, kernels, and integrations work best. Two systems exist because implementation choices and ecosystems differ, and competition keeps those choices evolving rather than producing one permanent winner.', equation: 'compare quality + TTFT + token latency + goodput + operating fit', insight: 'Use the same model, hardware, traffic trace, versions, and quality settings for a fair test.' },
    ],
    deepDive: [
      'vLLM grew from the PagedAttention work; SGLang’s paper describes a frontend for structured LLM programs and RadixAttention in its runtime. Today each project extends beyond its original contribution. A radix tree stores shared token paths explicitly; a hash-based block cache identifies prefixes through chained block keys.',
      'There is no benchmark winner implied by this scene. Compare supported model and attention variants, quantization kernels, distributed topology, structured generation needs, observability, and deployment experience. Measure both cold and warm caches under representative arrivals and output lengths; report latency percentiles as well as aggregate throughput.',
    ],
    sources: [
      { label: 'vLLM — project capabilities', url: 'https://github.com/vllm-project/vllm' },
      { label: 'SGLang — project capabilities', url: 'https://github.com/sgl-project/sglang' },
      { label: 'SGLang — original paper', url: 'https://arxiv.org/abs/2312.07104' },
      { label: 'PagedAttention — vLLM origins', url: 'https://arxiv.org/abs/2309.06180' },
    ],
  },
  {
    id: 'local', group: 3, title: 'How a model fits on your laptop',
    subtitle: 'Small architectures, learned compression, low-bit weights, and local runtimes make cloud-trained models usable on personal devices.', duration: 80,
    control: { label: 'Model parameter count', min: 0, max: 1, step: 0.01, value: 0.35, low: 'Smaller model', high: 'Larger model' },
    acts: [
      { title: 'Training and inference are different jobs', narration: 'Training repeatedly changes model weights using enormous amounts of data and computation. Inference loads the resulting weights and performs forward calculations for your prompt. Your laptop does not repeat the training process. A model trained on a large cluster can therefore run locally when its inference memory and compute requirements fit.', equation: 'training learns weights → inference uses those weights', insight: 'Cloud-scale training does not imply cloud-only inference.' },
      { title: 'Design a smaller student', narration: 'Meta’s lightweight Llama 3.2 text models provide a concrete example. The one-billion and three-billion parameter variants used structured pruning and knowledge distillation, drawing on larger models during development. Pruning removes selected structure, and distillation trains the smaller student toward useful teacher behavior. This reduces size while retaining a targeted set of capabilities.', equation: 'larger teacher → pruning + distillation → smaller student', insight: 'A smaller model is learned and evaluated; it is not just a larger file zipped up.' },
      { title: 'Pack it for the machine', narration: 'Quantization further reduces the bytes needed for weights. A local runtime such as llama.cpp or MLX supplies kernels suited to the available CPU or GPU. The total memory budget includes the model, KV cache, and scratch space. Move the parameter control: larger models leave less room for long conversations and other applications.', equation: 'required memory ≈ weights + KV cache + working buffers', insight: 'Parameter count and precision both affect whether a model fits.' },
      { title: 'Local has a different operating point', narration: 'A personal device often serves one user and values low overhead, privacy, and responsiveness. A data center often serves many concurrent users and values scheduling efficiency and fleet capacity. Both perform inference, but their useful batch sizes and hardware differ. Fitting in memory is necessary; acceptable speed and task quality still need measurement.', equation: 'fits in memory ≠ fast enough ≠ capable enough', insight: 'Choose model size, context length, and precision together for the intended task.' },
    ],
    deepDive: [
      'Llama 3.2 is a historical example, not a claim that every Meta model uses the same compression recipe. The lightweight text models and the larger vision models have different purposes. Small models can be useful while still losing capability on difficult reasoning, knowledge, or instruction-following tasks.',
      'Local execution can use CPU memory, GPU memory, or unified memory, depending on the platform and runtime. Offloading can make a model runnable but introduce transfer and bandwidth costs. Running locally avoids sending the prompt to a remote inference service when the application itself makes no external calls.',
    ],
    sources: [
      { label: 'Meta — Llama 3.2 lightweight models', url: 'https://ai.meta.com/blog/llama-3-2-connect-2024-vision-edge-mobile-devices/' },
      { label: 'Meta — Llama 3.2 model card', url: 'https://github.com/meta-llama/llama-models/blob/main/models/llama3_2/MODEL_CARD.md' },
      { label: 'llama.cpp — local inference runtime', url: 'https://github.com/ggml-org/llama.cpp' },
      { label: 'Apple MLX — local language model tools', url: 'https://github.com/ml-explore/mlx-lm' },
    ],
  },
  {
    id: 'datacenter', group: 3, title: 'A request inside the data center',
    subtitle: 'Production inference is a coordinated journey through admission, routing, GPU scheduling, streaming, and memory reclamation.', duration: 80,
    control: { label: 'Incoming request traffic', min: 0, max: 1, step: 0.01, value: 0.55, low: 'Quiet fleet', high: 'Busy fleet' },
    acts: [
      { title: 'Arrive and earn a place', narration: 'A request reaches an API gateway, where authentication, limits, and input checks establish whether it can proceed. The system tokenizes and prepares the prompt. Admission control considers available capacity instead of allowing an unlimited queue. A router then selects an eligible model replica, taking load and possibly useful cached prefixes into account.', equation: 'client → gateway → admission → tokenizer → router', insight: 'A request can spend substantial time outside the GPU.' },
      { title: 'Join the moving batch', narration: 'Inside the selected replica, a scheduler reserves KV capacity and admits prompt work into iterations. Prefill constructs context state, then decoding adds tokens while other users share the accelerator. Tensor or pipeline ranks may collaborate inside the replica. In a disaggregated deployment, a separate worker receives the cache and continues the answer.', equation: 'queue → prefill → KV state → repeated decode steps', insight: 'One user’s request usually shares hardware with many independent conversations.' },
      { title: 'Stream and measure the experience', narration: 'As tokens become available, the server converts them back into text and streams chunks toward the client. Time to first token measures the initial wait; inter-token latency describes the ongoing cadence. Total throughput alone can hide a poor experience. Operators examine latency percentiles, queue depth, active requests, and memory pressure together.', equation: 'TTFT = first-token time − arrival;  ITL = token-to-token gap', insight: 'A smooth stream and a fast first response are different service objectives.' },
      { title: 'Stop means release the work', narration: 'A request ends on a stop condition, length limit, error, or cancellation. The engine removes it from future batches and releases its active cache ownership. Reusable prefix state may remain under an eviction policy. Increase traffic: fair admission, prompt cancellation, and timely memory reclamation keep completed or abandoned work from blocking new users.', equation: 'finish or cancel → unschedule → release ownership → reuse capacity', insight: 'Cancellation must reach the execution engine, not merely close the user interface.' },
    ],
    deepDive: [
      'This is a representative architecture, not a trace from a particular provider. Real systems may place tokenization before routing, split prefill from decode, include multimodal encoders, or use external KV tiers. Authentication and policy checks belong at the service boundary; detailed scheduling belongs near the execution engine.',
      'At overload, bounded queues and explicit rejection can protect existing latency targets. Fairness may use per-tenant quotas or scheduling policies. Autoscaling is slower than an individual decode iteration because workers must acquire resources and load weights, so it complements admission control rather than replacing it.',
      'Measure request-level latency at a clearly stated boundary. Network chunk buffering can make client-observed token gaps differ from engine iteration times. This scene uses synthetic requests and illustrative motion; no throughput values or provider-specific fleet measurements are implied.',
    ],
    sources: [
      { label: 'NVIDIA Dynamo — router request path', url: 'https://docs.nvidia.com/dynamo/dev/knowledge-base/modular-components/router/overview' },
      { label: 'NVIDIA Dynamo — request rejection architecture', url: 'https://docs.nvidia.com/dynamo/dev/knowledge-base/concepts/fault-tolerance/request-rejection-architecture' },
      { label: 'vLLM — production metrics', url: 'https://docs.vllm.ai/en/latest/usage/metrics/' },
      { label: 'vLLM — cancellation reaches the engine', url: 'https://docs.vllm.ai/en/latest/api/vllm/v1/engine/async_llm/' },
    ],
  },
];
