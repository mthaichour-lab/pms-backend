import { describe, expect, it } from 'vitest';
import { validateUserInput, UserAdministrationService } from '../../../apps/api/src/user-administration/user-administration.service.js';
const profile = { username: 'test.user', password: 'temporary-test-password', roles: ['RELATIONSHIP_MANAGER'], enabled: true, branchIds: ['001'], delegationLevel: 1, maximumAmount: '10000.00' };
describe('user administration validation', () => {
  it('accepts explicit role and delegation assignments', () => { expect(validateUserInput(profile, true)).toMatchObject({ roles: ['RELATIONSHIP_MANAGER'], branchIds: ['001'], maximumAmount: '10000.00' }); });
  it.each([{ roles: ['SUPER_ADMIN'] }, { roles: [] }, { delegationLevel: 6 }, { delegationLevel: 1.5 }, { branchIds: ['*'] }, { maximumAmount: '-1' }, { maximumAmount: '1e10' }, { arbitraryPrivilege: true }, { username: 'service-account-test' }, { password: 'short' }])('rejects invalid grants or input %o', patch => { expect(() => validateUserInput({ ...profile, ...patch }, true)).toThrow(); });
  it('rejects password and username changes through the role update endpoint', () => { expect(() => validateUserInput(profile, false)).toThrow(); });
  it('prevents an administrator from disabling their own access', async () => {
    const users = new UserAdministrationService();
    await expect(users.update('self', { roles: ['SYSTEM_ADMIN'], enabled: false }, 'self')).rejects.toThrow('propre accès');
    await expect(users.update('self', { roles: ['RELATIONSHIP_MANAGER'] }, 'self')).rejects.toThrow('propre accès');
  });
});
