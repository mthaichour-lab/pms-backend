import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

interface OpenApiDocument {
  paths: Record<string, { post?: { responses?: Record<string, { content?: { 'application/json'?: { schema?: { $ref?: string } } } }> } }>;
  components: { schemas: Record<string, { required?: string[]; properties?: Record<string, unknown> }> };
}

describe('allocation response contract', () => {
  it('describes the enriched simulation and recording envelopes returned by the application service', async () => {
    const contract = JSON.parse(
      await readFile(new URL('../../contracts/openapi/pms-api.v1.json', import.meta.url), 'utf8'),
    ) as OpenApiDocument;

    expect(responseRef(contract, '/investment-pools/{poolId}/allocations/simulate'))
      .toBe('#/components/schemas/AllocationSimulation');
    expect(responseRef(contract, '/investment-pools/{poolId}/allocations'))
      .toBe('#/components/schemas/RecordedAllocation');
    expect(contract.components.schemas.AllocationSimulation?.required).toEqual(expect.arrayContaining([
      'remainingPercentage', 'currentAllocatedPercentage', 'simulated', 'blockingAnomalies',
      'approvalRequired', 'executable',
    ]));
    expect(contract.components.schemas.RecordedAllocation?.required).toEqual([
      'allocation', 'remainingPercentage', 'status',
    ]);
  });
});

function responseRef(contract: OpenApiDocument, path: string): string | undefined {
  return contract.paths[path]?.post?.responses?.['201']?.content?.['application/json']?.schema?.$ref;
}
