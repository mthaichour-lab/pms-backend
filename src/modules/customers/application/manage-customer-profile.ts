import { CustomerProfile, type CustomerProfileState, type LegalRestriction } from '../domain/customer-profile.js';
export interface CustomerProfileRepository { save(profile: Readonly<CustomerProfileState>, actorId: string): Promise<void>; find(customerId: string): Promise<CustomerProfileState | undefined>; }
export class ManageCustomerProfile { constructor(private readonly repository: CustomerProfileRepository) {}
  async create(profile: CustomerProfileState, actorId: string) { const customer=CustomerProfile.create(profile); await this.repository.save(customer.snapshot(), actorId); return customer.snapshot(); }
  async get(customerId:string){const state=await this.repository.find(customerId);if(!state)throw new Error(`Customer not found: ${customerId}`);return state}
  async addRestriction(customerId:string,restriction:LegalRestriction,actorId:string){const customer=CustomerProfile.restore(await this.get(customerId));customer.addRestriction(restriction);await this.repository.save(customer.snapshot(),actorId);return customer.snapshot()}
  async liftRestriction(customerId:string,restrictionId:string,liftedAt:string,actorId:string){const customer=CustomerProfile.restore(await this.get(customerId));customer.liftRestriction(restrictionId,liftedAt);await this.repository.save(customer.snapshot(),actorId);return customer.snapshot()}
  async assertProfitRightsOperationAllowed(customerId:string){const customer=CustomerProfile.restore(await this.get(customerId));customer.assertProfitRightsOperationAllowed()}
}
