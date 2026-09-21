import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PMS_ROLES, type PmsRole } from '../../../../src/shared-kernel/authorization-contracts.js';

export const ROLE_GROUPS: Record<PmsRole, string> = {
  FINANCE_ANALYST: 'pms-finance-analysts', FINANCE_CONTROLLER: 'pms-finance-controllers',
  RELATIONSHIP_MANAGER: 'pms-relationship-managers', RISK_ANALYST: 'pms-risk-analysts',
  SHARIA_AUDITOR: 'pms-sharia-auditors', SYSTEM_ADMIN: 'pms-system-admins',
};
export const ROLE_DESCRIPTIONS = [
  { id: 'FINANCE_ANALYST', label: 'Analyste finance', privileges: ['Consulter les produits et pools', 'Simuler les allocations et calculs'] },
  { id: 'FINANCE_CONTROLLER', label: 'Contrôleur finance', privileges: ['Contrôler les opérations', 'Valider selon la délégation', 'Consulter les soldes'] },
  { id: 'RELATIONSHIP_MANAGER', label: 'Chargé de clientèle', privileges: ['Gérer les clients', 'Effectuer les souscriptions'] },
  { id: 'RISK_ANALYST', label: 'Analyste risques', privileges: ['Consulter les risques et limites'] },
  { id: 'SHARIA_AUDITOR', label: 'Auditeur Charia', privileges: ['Contrôler la conformité Charia'] },
  { id: 'SYSTEM_ADMIN', label: 'Administrateur système', privileges: ['Administrer les profils et rôles', 'Accéder aux fonctions autorisées par les politiques PMS'] },
];
interface KeycloakUser { id: string; username: string; firstName?: string; lastName?: string; email?: string; enabled?: boolean; serviceAccountClientId?: string; attributes?: Record<string, string[]> }
interface Group { id: string; name: string }
export interface UserInput { username?: string; firstName?: string; lastName?: string; email?: string; password?: string; enabled: boolean; roles: PmsRole[]; legalEntityIds: string[]; branchIds: string[]; poolIds: string[]; delegationLevel: number; maximumAmount: string }

export function validateUserInput(value: unknown, creating: boolean): UserInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Profil invalide');
  const body = value as Record<string, unknown>;
  const allowed = ['firstName', 'lastName', 'email', 'enabled', 'roles', 'legalEntityIds', 'branchIds', 'poolIds', 'delegationLevel', 'maximumAmount', ...(creating ? ['username', 'password'] : [])];
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new BadRequestException('Champ de profil non autorisé');
  if (!Array.isArray(body.roles) || body.roles.length < 1 || body.roles.length > 6 || body.roles.some(role => !(PMS_ROLES as readonly unknown[]).includes(role))) throw new BadRequestException('Sélectionnez au moins un rôle PMS valide');
  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') throw new BadRequestException('Statut invalide');
  const result: UserInput = { enabled: body.enabled !== false, roles: [...new Set(body.roles)] as PmsRole[], legalEntityIds: [], branchIds: [], poolIds: [], delegationLevel: 0, maximumAmount: '0' };
  for (const field of ['firstName', 'lastName', 'email'] as const) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'string' || body[field].length > 254 || /[\u0000-\u001f]/.test(body[field])) throw new BadRequestException(`${field} invalide`);
      result[field] = body[field].trim();
    }
  }
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new BadRequestException('Adresse email invalide');
  for (const field of ['legalEntityIds', 'branchIds', 'poolIds'] as const) {
    const entries = body[field] ?? [];
    if (!Array.isArray(entries) || entries.length > 100 || entries.some(entry => typeof entry !== 'string' || !/^[A-Za-z0-9._:-]{1,100}$/.test(entry))) throw new BadRequestException(`${field} invalide`);
    result[field] = [...new Set(entries)] as string[];
  }
  const delegation = body.delegationLevel ?? 0;
  if (!Number.isInteger(delegation) || (delegation as number) < 0 || (delegation as number) > 5) throw new BadRequestException('Niveau de délégation attendu entre 0 et 5');
  result.delegationLevel = delegation as number;
  const amount = body.maximumAmount ?? '0';
  if (typeof amount !== 'string' || !/^(0|[1-9]\d{0,17})(\.\d{1,2})?$/.test(amount)) throw new BadRequestException('Plafond invalide');
  result.maximumAmount = amount;
  if (creating) {
    if (typeof body.username !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._@-]{2,63}$/.test(body.username) || body.username.startsWith('service-account-')) throw new BadRequestException('Identifiant attendu: 3 à 64 caractères');
    if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) throw new BadRequestException('Mot de passe temporaire attendu: 12 à 128 caractères');
    result.username = body.username; result.password = body.password;
  }
  return result;
}

@Injectable()
export class UserAdministrationService {
  private readonly baseUrl = process.env['KEYCLOAK_ADMIN_URL'];
  private readonly realm = process.env['KEYCLOAK_ADMIN_REALM'] ?? 'pms-dev';
  private readonly clientId = process.env['KEYCLOAK_ADMIN_CLIENT_ID'] ?? 'pms-user-admin';
  private readonly secret = process.env['KEYCLOAK_ADMIN_CLIENT_SECRET'];

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    if (!this.baseUrl || !this.secret) throw new ServiceUnavailableException('Administration des profils non configurée');
    try {
      const tokenResponse = await fetch(`${this.baseUrl}/realms/${encodeURIComponent(this.realm)}/protocol/openid-connect/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: this.clientId, client_secret: this.secret }), signal: AbortSignal.timeout(10000) });
      if (!tokenResponse.ok) throw new ServiceUnavailableException('Connexion au gestionnaire des profils impossible');
      const token = await tokenResponse.json() as { access_token?: string };
      if (!token.access_token) throw new ServiceUnavailableException('Connexion au gestionnaire des profils impossible');
      const response = await fetch(`${this.baseUrl}/admin/realms/${encodeURIComponent(this.realm)}/${path}`, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(10000) });
      if (response.status === 409) throw new ConflictException('Identifiant ou email déjà utilisé');
      if (response.status === 404) throw new NotFoundException('Profil introuvable');
      if (!response.ok) throw new ServiceUnavailableException('Opération refusée par le gestionnaire des profils');
      return response;
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException || error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Gestionnaire des profils indisponible');
    }
  }

  private async groups(): Promise<Group[]> { return (await this.request('groups?max=1000')).json() as Promise<Group[]>; }
  private async userGroups(id: string): Promise<Group[]> { return (await this.request(`users/${encodeURIComponent(id)}/groups?max=1000`)).json() as Promise<Group[]>; }
  private async view(user: KeycloakUser) {
    const groups = await this.userGroups(user.id);
    const attrs = user.attributes ?? {};
    return { id: user.id, username: user.username, firstName: user.firstName ?? '', lastName: user.lastName ?? '', email: user.email ?? '', enabled: user.enabled === true,
      roles: PMS_ROLES.filter(role => groups.some(group => group.name === ROLE_GROUPS[role])),
      legalEntityIds: attrs.legal_entity_ids ?? [], branchIds: attrs.branch_ids ?? [], poolIds: attrs.pool_ids ?? [],
      delegationLevel: Number(attrs.delegation_level?.[0] ?? 0), maximumAmount: attrs.maximum_amount?.[0] ?? '0' };
  }
  async list(search = '', limit = 50, offset = 0) {
    if (search.length > 100 || !Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset > 100000) throw new BadRequestException('Recherche ou pagination invalide');
    const query = new URLSearchParams({ search, max: String(limit), first: String(offset), briefRepresentation: 'false' });
    const users = await (await this.request(`users?${query}`)).json() as KeycloakUser[];
    const total = await (await this.request(`users/count?${new URLSearchParams({ search })}`)).json() as number;
    return { items: await Promise.all(users.filter(user => !user.serviceAccountClientId && !user.username.startsWith('service-account-')).map(user => this.view(user))), total };
  }
  private attributes(input: UserInput) {
    return { legal_entity_ids: input.legalEntityIds, branch_ids: input.branchIds, pool_ids: input.poolIds, delegation_level: [String(input.delegationLevel)], maximum_amount: [input.maximumAmount] };
  }
  private async assign(id: string, roles: PmsRole[]) {
    const [groups, current] = await Promise.all([this.groups(), this.userGroups(id)]);
    const target = roles.map(role => groups.find(group => group.name === ROLE_GROUPS[role]));
    if (target.some(group => !group)) throw new ServiceUnavailableException('Groupes PMS non configurés');
    // Revoke removed privileges before adding new grants; unrelated groups are retained.
    for (const group of current) if (Object.values(ROLE_GROUPS).includes(group.name) && !target.some(item => item?.id === group.id)) await this.request(`users/${encodeURIComponent(id)}/groups/${encodeURIComponent(group.id)}`, { method: 'DELETE' });
    for (const group of target) if (group && !current.some(item => item.id === group.id)) await this.request(`users/${encodeURIComponent(id)}/groups/${encodeURIComponent(group.id)}`, { method: 'PUT' });
  }
  async create(body: unknown) {
    const input = validateUserInput(body, true);
    const groups = await this.groups();
    if (input.roles.some(role => !groups.some(group => group.name === ROLE_GROUPS[role]))) throw new ServiceUnavailableException('Groupes PMS non configurés');
    const response = await this.request('users', { method: 'POST', body: JSON.stringify({ username: input.username, firstName: input.firstName, lastName: input.lastName, email: input.email, enabled: input.enabled, attributes: this.attributes(input), groups: input.roles.map(role => `/${ROLE_GROUPS[role]}`), credentials: [{ type: 'password', value: input.password, temporary: true }], requiredActions: ['UPDATE_PASSWORD'] }) });
    const id = response.headers.get('location')?.split('/').pop();
    if (!id) throw new ServiceUnavailableException('Profil créé, rechargez la liste');
    return this.view(await (await this.request(`users/${encodeURIComponent(id)}`)).json() as KeycloakUser);
  }
  async update(id: string, body: unknown, actorId: string) {
    if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) throw new BadRequestException('Identifiant de profil invalide');
    const input = validateUserInput(body, false);
    if (id === actorId && (!input.enabled || !input.roles.includes('SYSTEM_ADMIN'))) throw new ForbiddenException('Vous ne pouvez pas retirer votre propre accès administrateur');
    const current = await (await this.request(`users/${encodeURIComponent(id)}`)).json() as KeycloakUser;
    if (current.serviceAccountClientId || current.username.startsWith('service-account-')) throw new ForbiddenException('Compte technique non modifiable');
    await this.assign(id, input.roles);
    await this.request(`users/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ firstName: input.firstName, lastName: input.lastName, email: input.email, enabled: input.enabled, attributes: { ...current.attributes, ...this.attributes(input) } }) });
    // Active sessions must not retain revoked privileges.
    await this.request(`users/${encodeURIComponent(id)}/logout`, { method: 'POST' });
    return this.view(await (await this.request(`users/${encodeURIComponent(id)}`)).json() as KeycloakUser);
  }
}
