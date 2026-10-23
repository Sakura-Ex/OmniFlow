# Browser performance measurements

2026-10-23T08:17:16.310Z

Vite development build. Render includes store update, React commit and two animation frames, not GPU completion. All nodes mounted; 5000-node render intentionally omitted. No browser native memory metric available.

User agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36; logical processors: 32. Hardware matches the [backend report](performance-backend.md). One warmup and twenty samples per fixed chain.

| Machines | Request bytes | Compile P50/P95 ms | Serialize P50/P95 ms | Store/React/two-frame P50/P95 ms |
|---|---:|---:|---:|---:|
| 100 | 14671 | 13.40 / 22.50 | 0.00 / 0.10 | 193.60 / 268.20 |
| 1000 | 146977 | 128.10 / 154.90 | 0.30 / 0.40 | 2055.30 / 2361.00 |
| 5000 | 762977 | 637.00 / 696.40 | 1.30 / 1.40 | not measured |

Raw samples: [current](performance-browser.json), [before indexing](performance-browser-before-indexing.json), [intermediate indexed build](performance-browser-after-indexing.json). The same 5000-machine compilation P95 fell from 2657.0 ms to 696.4 ms after replacing repeated scans with node/port/net indexes and caching normalized unit expressions; model fixtures remain identical. These runs are on a shared desktop, so they are diagnostic comparisons rather than isolated microbenchmarks.

Reproduce through /tests/browser/browser.html and Run browser benchmark. Compilation excludes fixture construction and store updates. Rendering includes store shaping/cache work, React commits and two animation frames; it is not GPU timing. The 5000-node rendering measurement is intentionally omitted; browser native memory is unavailable. Backend native memory, transport and queue metrics are reported separately. Development results do not promise production latency.
