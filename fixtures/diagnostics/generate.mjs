import { createServer } from 'vite'
import { writeFile } from 'node:fs/promises'
const server = await createServer({ server: { middlewareMode: true } })
try {
  const { diagnosticCases } = await server.ssrLoadModule('/fixtures/diagnostics/cases.ts')
  await writeFile(new URL('./models.json', import.meta.url), JSON.stringify(diagnosticCases(), null, 2) + '\n')
} finally { await server.close() }
