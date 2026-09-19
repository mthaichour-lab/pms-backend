import { describe, expect, it } from 'vitest';

import { assertExportDatasetSafe } from '../../../src/modules/reporting/domain/secure-export.js';

describe('secure export dataset integrity', () => {
  it('rejects non-finite numbers that JSON would silently convert to null', () => {
    expect(() => assertExportDatasetSafe({
      columns: [{ key: 'amount', label: 'Amount' }], rows: [{ amount: Number.NaN }],
    })).toThrow('must be finite');
  });

  it('rejects structured values and malformed runtime columns', () => {
    expect(() => assertExportDatasetSafe({
      columns: [{ key: 'amount', label: 'Amount' }], rows: [{ amount: { nested: 'value' } }],
    } as never)).toThrow('must be scalar');
    expect(() => assertExportDatasetSafe({
      columns: [{ key: 'customer', label: 'Customer', personalData: 'yes' }],
      rows: [{ customer: 'tok_1234567890abcdef' }],
    } as never)).toThrow('columns must be unique and valid');
  });
});
