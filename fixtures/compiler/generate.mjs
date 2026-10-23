import { createServer } from 'vite'
import { writeFile } from 'node:fs/promises'

const server = await createServer({ server: { middlewareMode: true } })
try {
  const { compilerCases } = await server.ssrLoadModule('/fixtures/compiler/cases.ts')
  await writeFile(new URL('./models.json', import.meta.url), JSON.stringify(compilerCases(), null, 2) + '\n')
} finally {
  await server.close()
}
