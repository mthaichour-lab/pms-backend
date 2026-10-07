import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { PoolingController } from '../../../apps/api/src/pooling/pooling.controller.js';

describe('PoolingController asset catalogue', () => {
  it('lists allocatable positions with default and explicit pagination', async () => {
    const listAssets = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const controller = new PoolingController(
      { list: vi.fn() } as never,
      {} as never,
      { listAssets } as never,
      {} as never,
    );

    await expect(controller.listAssets()).resolves.toEqual({ items: [], total: 0 });
    await expect(controller.listAssets('25', '50')).resolves.toEqual({ items: [], total: 0 });
    expect(listAssets).toHaveBeenNthCalledWith(1, undefined, undefined);
    expect(listAssets).toHaveBeenNthCalledWith(2, 25, 50);
  });

  it('rejects malformed catalogue pagination before querying the repository', async () => {
    const listAssets = vi.fn();
    const controller = new PoolingController({} as never, {} as never, { listAssets } as never, {} as never);

    await expect(controller.listAssets('10.5', '0')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.listAssets('10', '-1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.listAssets('101', '0')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.listAssets('10', '999999999999999999999')).rejects.toBeInstanceOf(BadRequestException);
    expect(listAssets).not.toHaveBeenCalled();
  });
});
