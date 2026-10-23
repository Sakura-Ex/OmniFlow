import { describe, expect, it } from 'vitest'
import modelJson from '../../../fixtures/lp/models.json?raw'
import responseJson from '../../../fixtures/lp/responses.json?raw'
import { LPRequestSchema, LPResponseSchema } from '@/common/types/lp'
import { readCalculationResponse, formatCalculationError } from './calculationClient'

const models = JSON.parse(modelJson) as Array<{ id: string; request: unknown }>
const responses = JSON.parse(responseJson) as Array<{ id: string; response: unknown }>
const request = () => LPRequestSchema.parse(models[0].request)
const response = () => LPResponseSchema.parse(responses[0].response)

describe('versioned LP response acceptance', () => {
  it.each(models)('validates the $id response against its exact request', async model => {
    const expected = LPResponseSchema.parse(responses.find(item => item.id === model.id)!.response)
    expect(await readCalculationResponse(Response.json(expected), LPRequestSchema.parse(model.request))).toEqual(JSON.parse(JSON.stringify(expected)))
  })
  it.each(['request_id', 'document_revision', 'compiler_fingerprint'] as const)('rejects mismatched %s', async key => {
    const result = response()
    await expect(readCalculationResponse(Response.json({ ...result, [key]: key === 'document_revision' ? 99 : 'other' }), request())).rejects.toThrow('identity')
  })
  it('rejects old graph responses, malformed JSON and wrong schema versions', async () => {
    await expect(readCalculationResponse(Response.json({ status: 'success', node_results: {} }), request())).rejects.toThrow('请从当前项目重新启动后端')
    await expect(readCalculationResponse(new Response('gateway', { status: 502 }), request())).rejects.toThrow('HTTP 502')
    await expect(readCalculationResponse(Response.json({ ...response(), schema_version: 'old' }), request())).rejects.toThrow('格式不兼容')
  })
  it('rejects variable vectors from a different model', async () => {
    const result = response()
    result.solution!.variable_ids[0] = 'other'
    result.solution!.feasibility.bound_slacks[0].variable_id = 'other'
    await expect(readCalculationResponse(Response.json(result), request())).rejects.toThrow('variable identities')
  })
  it('formats mapped diagnostics with their port locations', () => {
    expect(formatCalculationError({ status: 'invalid_model', errors: [{ node_id: 's', path: ['port'], code: 'missing', message: 'Required' }] })).toContain('s: port — Required')
  })
})
