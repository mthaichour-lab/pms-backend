export interface InvestmentPositionPublicationRepository {
  publish(batchId: string): Promise<number>;
}

export class PublishInvestmentPositions {
  constructor(private readonly repository: InvestmentPositionPublicationRepository) {}

  execute(batchId: string): Promise<number> {
    return this.repository.publish(batchId);
  }
}
