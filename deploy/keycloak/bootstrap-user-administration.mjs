// Local bootstrap only. Credentials are read from the environment and never logged.
const base = process.env.KEYCLOAK_URL ?? 'http://keycloak:8080';
const realm = 'pms-dev';
const secret = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET;
if (!secret || secret.length < 24) throw new Error('KEYCLOAK_ADMIN_CLIENT_SECRET requires at least 24 characters');
let token;
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const response = await fetch(`${base}/realms/master/protocol/openid-connect/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: process.env.ADMIN_USER ?? 'admin', password: process.env.ADMIN_PASSWORD ?? '' }) });
    if (response.ok) { token = (await response.json()).access_token; break; }
  } catch {}
  await new Promise(resolve => setTimeout(resolve, 2000));
}
if (!token) throw new Error('Keycloak bootstrap authentication failed');
async function request(path, method = 'GET', body) {
  const response = await fetch(`${base}/admin/realms/${realm}/${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) throw new Error(`Keycloak bootstrap ${method} failed (${response.status})`);
  return response.status === 204 || response.status === 201 ? undefined : response.json();
}
const roleGroups = ['pms-finance-analysts', 'pms-finance-controllers', 'pms-relationship-managers', 'pms-risk-analysts', 'pms-sharia-auditors', 'pms-system-admins'];
const currentGroups = await request('groups?max=1000');
for (const name of roleGroups) if (!currentGroups.some(group => group.name === name)) await request('groups', 'POST', { name });
let client = (await request('clients?clientId=pms-user-admin'))[0];
const configuration = { clientId: 'pms-user-admin', name: 'PMS user administration service', enabled: true, publicClient: false, standardFlowEnabled: false, directAccessGrantsEnabled: false, serviceAccountsEnabled: true, secret };
if (!client) { await request('clients', 'POST', configuration); client = (await request('clients?clientId=pms-user-admin'))[0]; }
else await request(`clients/${client.id}`, 'PUT', configuration);
const serviceUser = await request(`clients/${client.id}/service-account-user`);
const management = (await request('clients?clientId=realm-management'))[0];
const roles = await Promise.all(['view-users', 'query-users', 'query-groups', 'manage-users'].map(name => request(`clients/${management.id}/roles/${name}`)));
await request(`users/${serviceUser.id}/role-mappings/clients/${management.id}`, 'POST', roles);

// Map only explicit user attributes into scopes and delegation; never grant every user a hardcoded privilege.
const attributeClaims = { legal_entity_ids: { multi: true, type: 'String' }, branch_ids: { multi: true, type: 'String' }, pool_ids: { multi: true, type: 'String' }, delegation_level: { multi: false, type: 'int' }, maximum_amount: { multi: false, type: 'String' } };
// Keycloak 26 drops unmanaged attributes. Declare grants as admin-only fields:
// the account console must never let a user grant themselves a scope or delegation.
const profile = await request('users/profile');
for (const [name, config] of Object.entries(attributeClaims)) {
  const definition = { name, displayName: name, multivalued: config.multi, permissions: { view: ['admin'], edit: ['admin'] } };
  const index = profile.attributes.findIndex(attribute => attribute.name === name);
  if (index < 0) profile.attributes.push(definition);
  else profile.attributes[index] = { ...profile.attributes[index], ...definition };
}
await request('users/profile', 'PUT', profile);
for (const clientId of ['pms-web', 'pms-e2e']) {
  const app = (await request(`clients?clientId=${clientId}`))[0];
  if (!app) continue;
  const mappers = await request(`clients/${app.id}/protocol-mappers/models`);
  const replacements = [
    { name: 'pms-groups', protocol: 'openid-connect', protocolMapper: 'oidc-group-membership-mapper', config: { 'full.path': 'false', 'id.token.claim': 'true', 'access.token.claim': 'true', 'userinfo.token.claim': 'true', 'claim.name': 'groups' } },
    ...Object.entries(attributeClaims).map(([claim, config]) => ({ name: `pms-${claim}`, protocol: 'openid-connect', protocolMapper: 'oidc-usermodel-attribute-mapper', config: { 'user.attribute': claim, 'claim.name': claim, 'jsonType.label': config.type, multivalued: String(config.multi), 'id.token.claim': 'true', 'access.token.claim': 'true', 'userinfo.token.claim': 'true' } })),
  ];
  // Preserve local developer delegation previously supplied by hardcoded mappers.
  const dev = (await request(`users?username=${encodeURIComponent(process.env.DEV_USER ?? 'developer')}&exact=true`))[0];
  if (dev) {
    const full = await request(`users/${dev.id}`);
    const attributes = { ...full.attributes };
    for (const mapper of mappers) {
      const claim = mapper.config?.['claim.name'];
      const value = mapper.config?.['claim.value'];
      if (claim in attributeClaims && value !== undefined && !attributes[claim]) {
        let parsed; try { parsed = JSON.parse(value); } catch { parsed = value; }
        attributes[claim] = (Array.isArray(parsed) ? parsed : [parsed]).map(String);
      }
    }
    if (process.env.DEV_DELEGATION_LEVEL && !attributes.delegation_level) attributes.delegation_level = [process.env.DEV_DELEGATION_LEVEL];
    if (process.env.DEV_MAXIMUM_AMOUNT && !attributes.maximum_amount) attributes.maximum_amount = [process.env.DEV_MAXIMUM_AMOUNT];
    for (const [claim, key] of [['pool_ids', 'DEV_POOL_IDS'], ['branch_ids', 'DEV_BRANCH_IDS'], ['legal_entity_ids', 'DEV_LEGAL_ENTITY_IDS']]) {
      if (process.env[key] && !attributes[claim]) attributes[claim] = process.env[key].split(',').filter(Boolean);
    }
    await request(`users/${dev.id}`, 'PUT', { ...full, firstName: full.firstName || 'PMS', lastName: full.lastName || 'Developer', email: full.email || process.env.DEV_EMAIL || 'developer@pms.local', attributes });
  }
  for (const replacement of replacements) {
    const existing = mappers.filter(mapper => mapper.config?.['claim.name'] === replacement.config['claim.name']);
    if (existing.length) {
      await request(`clients/${app.id}/protocol-mappers/models/${existing[0].id}`, 'PUT', { ...replacement, id: existing[0].id });
      for (const duplicate of existing.slice(1)) await request(`clients/${app.id}/protocol-mappers/models/${duplicate.id}`, 'DELETE');
    } else await request(`clients/${app.id}/protocol-mappers/models`, 'POST', replacement);
  }
}
console.log('PMS user administration configured.');
