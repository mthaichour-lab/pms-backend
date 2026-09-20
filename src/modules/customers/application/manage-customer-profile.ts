import { CustomerProfile, type CustomerProfileState, type LegalRestriction } from '../domain/customer-profile.js';
export interface CustomerListQuery { limit: number; offset: number; }
export interface CustomerListPage { items: readonly CustomerProfileState[]; total: number; }
export interface CustomerProfileRepository { save(profile: Readonly<CustomerProfileState>, actorId: string): Promise<void>; find(customerId: string): Promise<CustomerProfileState | undefined>; list(input: CustomerListQuery): Promise<CustomerListPage>; }
export class ManageCustomerProfile { constructor(private readonly repository: CustomerProfileRepository) {}
  async create(profile: CustomerProfileState, actorId: string) { const customer=CustomerProfile.create(profile); await this.repository.save(customer.snapshot(), actorId); return customer.snapshot(); }
  async get(customerId:string){const state=await this.repository.find(customerId);if(!state)throw new Error(`Customer not found: ${customerId}`);return state}
  async list(limit?:number,offset?:number):Promise<CustomerListPage>{return this.repository.list(normalizePage(limit,offset))}
  async addRestriction(customerId:string,restriction:LegalRestriction,actorId:string){const customer=CustomerProfile.restore(await this.get(customerId));customer.addRestriction(restriction);await this.repository.save(customer.snapshot(),actorId);return customer.snapshot()}
  async liftRestriction(customerId:string,restrictionId:string,liftedAt:string,actorId:string){const customer=CustomerProfile.restore(await this.get(customerId));customer.liftRestriction(restrictionId,liftedAt);await this.repository.save(customer.snapshot(),actorId);return customer.snapshot()}
  async assertProfitRightsOperationAllowed(customerId:string){const customer=CustomerProfile.restore(await this.get(customerId));customer.assertProfitRightsOperationAllowed()}
}
function normalizePage(limit:number|undefined,offset:number|undefined):CustomerListQuery{const normalizedLimit=limit??50;const normalizedOffset=offset??0;if(!Number.isInteger(normalizedLimit)||normalizedLimit<1||normalizedLimit>100)throw new RangeError('limit must be an integer between 1 and 100');if(!Number.isInteger(normalizedOffset)||normalizedOffset<0)throw new RangeError('offset must be a non-negative integer');return{limit:normalizedLimit,offset:normalizedOffset}}
