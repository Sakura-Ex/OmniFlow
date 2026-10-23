import fs from 'node:fs'
const root = new URL('../../docs/validation/v2-completion/', import.meta.url)
const data = JSON.parse(fs.readFileSync(new URL('performance-browser.json', root), 'utf8'))
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1].toFixed(2)
let report = '# Browser performance measurements\n\n' + data.measuredAt + '\n\n' + data.note + '\n\nUser agent: ' + data.userAgent + '; logical processors: ' + data.hardwareConcurrency + '. Hardware matches the [backend report](performance-backend.md). One warmup and twenty samples per fixed chain.\n\n| Machines | Request bytes | Compile P50/P95 ms | Serialize P50/P95 ms | Store/React/two-frame P50/P95 ms |\n|---|---:|---:|---:|---:|\n'
for (const row of data.results) {
 const values = key => [0.5, 0.95].map(p => percentile(row.samples.map(sample => sample[key]), p)).join(' / ')
 report += `| ${row.size} | ${row.bytes} | ${values('compileMs')} | ${values('serializeMs')} | ${row.size <= 1000 ? values('renderCommitAndTwoFramesMs') : 'not measured'} |\n`
}
report += '\nRaw samples: [current](performance-browser.json), [before indexing](performance-browser-before-indexing.json), [intermediate indexed build](performance-browser-after-indexing.json). The same 5000-machine compilation P95 fell from 2657.0 ms to 696.4 ms after replacing repeated scans with node/port/net indexes and caching normalized unit expressions; model fixtures remain identical. These runs are on a shared desktop, so they are diagnostic comparisons rather than isolated microbenchmarks.\n\nReproduce through /tests/browser/browser.html and Run browser benchmark. Compilation excludes fixture construction and store updates. Rendering includes store shaping/cache work, React commits and two animation frames; it is not GPU timing. The 5000-node rendering measurement is intentionally omitted; browser native memory is unavailable. Backend native memory, transport and queue metrics are reported separately. Development results do not promise production latency.\n'
fs.writeFileSync(new URL('performance-browser.md', root), report)
