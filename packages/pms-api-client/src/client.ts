import type {
  PurificationCase,
  ChargePolicy,
  PoolCharge,
  RecognizedIncome,
  IncomeAdjustment,
  ApiStatus,
  ApprovedPoolOperation,
  ApprovePoolOperationCommand,
  CurrencyDefinition,
  InvestmentAccountSnapshot,
  CalculationRun,
  WorkflowApprovalCommand,
  WorkflowTransition,
  AccountingPostingResult,
  JournalReversalCommand,
  JournalReversalResult,
  ReconciliationCommand,
  ReconciliationResult,
  AccountingEventCommand,
  AccountingEventResult,
  AccountingAcknowledgementCommand,
  AccountingAcknowledgementResult,
  ShariaDecision,
  ShariaOpinion,
  ShariaReviewSubmission,
  ShariaReviewTransition,
  DcrCalculationCommand,
  DcrCalculationResult,
  StressScenarioCommand,
  StressScenarioResult,
  PublishedRiskDashboard,
  GeneratedRegulatoryReport,
  RegulatoryReportGeneration,
  RegulatoryReportPublication,
  RegulatoryReportTransition,
  CreateInvestmentProduct,
  InvestmentProduct,
  ProductTransitionCommand,
  ProductTermsDraft,
  ProductTermsSimulation,
  PublishProductTerms,
  ProductTerms,
  CreateComplianceReference,
  ComplianceReference,
  ProductReference,
  AssociateProductReference,
  ComplianceArbitration,
  RegulatoryRule,
  TokenizeCommand,
  TokenizeBatchCommand,
  TokenOperationCommand,
  TokenSearchCommand,
  TokenizedValue,
  DetokenizedValue,
  CbsDataQualityBatch,
  AssetAllocation,
  CreateInvestmentPool,
  InvestmentPool,
  PoolFundingSource,
  CreateSecureExport,
  SecureExportTransition,
  SecureExportApproval,
  SecureExportGeneration,
  GeneratedSecureExport,
  CustomerProfile,
  LegalRestriction,
  CreateInvestmentSubscription,
  InvestmentSubscriptionAction,
  InvestmentSubscription,
  PoolCompositionInput,
  PoolCompositionSnapshot,
  AssetAnomaly,
  Problem,
  CreateExceptionCase,
  ExceptionTransitionCommand,
  ExceptionTransition,
  AudienceDashboard,
  DashboardAudience,
  CreatePlanningScenario,
  PlanningScenarioTransitionCommand,
  PlanningScenarioTransition,
  ProfitExplanation,
  HistoricalYieldForecast,
  TenorYieldCurve,
  DocumentArchiveRequestCommand,
  DocumentArchiveQueued,
  DocumentArchiveRequest,
  AuditTrail,
} from './generated/schema.js';

export interface PmsApiClientOptions {
  baseUrl: string;
  accessToken: () => string | Promise<string>;
  fetch?: typeof globalThis.fetch;
}

export interface PurificationStatement {
  readonly openingCarry: string;
  readonly identified: string;
  readonly paid: string;
  readonly closingBalance: string;
  readonly cases: readonly PurificationCase[];
}
export interface QuotationCommand { readonly placementAmount: string; readonly targetNetRatePercent: string; readonly basis: { readonly type: 'GLOBAL_POOL' | 'FINANCING_TYPE' | 'DESIGNATED_FINANCING' | 'CUSTOMER' | 'SECTOR'; readonly reference?: string } }
export interface OpeningBalanceCertificationCommand { readonly certificationId: string; readonly signedAt: string; readonly lines: readonly { readonly component: 'HISTORICAL_ACCOUNTS' | 'PER' | 'IRR' | 'PAST_DISTRIBUTIONS'; readonly currencyCode: string; readonly migratedAmount: string; readonly generalLedgerAmount: string; readonly evidenceReference: string }[] }

export class PmsApiProblem extends Error {
  constructor(readonly problem: Problem) {
    super(problem.detail ?? problem.title);
    this.name = 'PmsApiProblem';
  }
}

export function createPmsApiClient(options: PmsApiClientOptions) {
  const fetchImplementation = options.fetch ?? globalThis.fetch;

  return {
    async requestDocumentArchive(input: CommandInput<DocumentArchiveRequestCommand>): Promise<DocumentArchiveQueued> {
      return genericCommandRequest<DocumentArchiveRequestCommand, DocumentArchiveQueued>('/documents/archive-requests', input);
    },
    async getDocumentArchiveRequest(input: { requestId: string; correlationId: string; traceparent?: string }): Promise<DocumentArchiveRequest> {
      return request<DocumentArchiveRequest>(`/documents/archive-requests/${encodeURIComponent(input.requestId)}`, { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent });
    },
    async getAuditTrail(input: { correlationId: string; traceparent?: string; limit?: number; action?: string; resourceType?: string; outcome?: 'SUCCESS' | 'DENIED' | 'FAILURE'; auditCorrelationId?: string; businessDateFrom?: string; businessDateTo?: string }): Promise<AuditTrail> {
      const parameters = new URLSearchParams();
      if (input.limit !== undefined) parameters.set('limit', String(input.limit));
      if (input.action !== undefined) parameters.set('action', input.action);
      if (input.resourceType !== undefined) parameters.set('resourceType', input.resourceType);
      if (input.outcome !== undefined) parameters.set('outcome', input.outcome);
      if (input.auditCorrelationId !== undefined) parameters.set('correlationId', input.auditCorrelationId);
      if (input.businessDateFrom !== undefined) parameters.set('businessDateFrom', input.businessDateFrom);
      if (input.businessDateTo !== undefined) parameters.set('businessDateTo', input.businessDateTo);
      const query = parameters.size === 0 ? '' : `?${parameters}`;
      return request<AuditTrail>(`/audit/events${query}`, { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent });
    },
    async getTenorYieldCurve(input: { poolId: string; customerToken?: string; correlationId: string; traceparent?: string }): Promise<TenorYieldCurve> {
      const query = input.customerToken ? `?${new URLSearchParams({ customerToken: input.customerToken })}` : '';
      return request<TenorYieldCurve>(`/reporting/tenor-curves/${encodeURIComponent(input.poolId)}${query}`, { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent });
    },
    async generateHistoricalYieldForecast(input: Omit<CommandInput<never>, 'command'> & { poolId: string }): Promise<HistoricalYieldForecast> {
      return request<HistoricalYieldForecast>(`/reporting/historical-yield-forecasts/${encodeURIComponent(input.poolId)}`, { method: 'POST', correlationId: input.correlationId, idempotencyKey: input.idempotencyKey, traceparent: input.traceparent, body: '{}' });
    },
    async getProfitExplanation(input: { runId: string; accountId: string; view?: 'SIMPLIFIED' | 'DETAILED'; correlationId: string; traceparent?: string }): Promise<ProfitExplanation> {
      const query = input.view ? `?${new URLSearchParams({ view: input.view })}` : '';
      return request<ProfitExplanation>(`/reporting/profit-explanations/${encodeURIComponent(input.runId)}/accounts/${encodeURIComponent(input.accountId)}${query}`, { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent });
    },
    async createPlanningScenario(input: CommandInput<CreatePlanningScenario>): Promise<PlanningScenarioTransition> {
      return genericCommandRequest<CreatePlanningScenario, PlanningScenarioTransition>('/reporting/planning-scenarios', input);
    },
    async transitionPlanningScenario(input: CommandInput<PlanningScenarioTransitionCommand> & { scenarioId: string }): Promise<PlanningScenarioTransition> {
      return genericCommandRequest<PlanningScenarioTransitionCommand, PlanningScenarioTransition>(`/reporting/planning-scenarios/${encodeURIComponent(input.scenarioId)}/transitions`, input);
    },
    async getAudienceDashboard(input: { audience: DashboardAudience; poolId?: string; correlationId: string; traceparent?: string }): Promise<AudienceDashboard> {
      const query = new URLSearchParams();
      if (input.poolId) query.set('poolId', input.poolId);
      const suffix = query.size ? `?${query}` : '';
      return request<AudienceDashboard>(`/reporting/dashboards/${encodeURIComponent(input.audience)}${suffix}`, { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent });
    },
    async createExceptionCase(input: CommandInput<CreateExceptionCase>): Promise<ExceptionTransition> {
      return genericCommandRequest<CreateExceptionCase, ExceptionTransition>('/exceptions', input);
    },
    async transitionExceptionCase(input: CommandInput<ExceptionTransitionCommand> & { exceptionId: string }): Promise<ExceptionTransition> {
      return genericCommandRequest<ExceptionTransitionCommand, ExceptionTransition>(`/exceptions/${encodeURIComponent(input.exceptionId)}/transitions`, input);
    },
    async listCbsDataQualityBatches(input: { businessDate?: string; state?: string; limit?: number; offset?: number; correlationId: string; traceparent?: string }): Promise<readonly CbsDataQualityBatch[]> {
      const query = new URLSearchParams();
      if (input.businessDate) query.set('businessDate', input.businessDate);
      if (input.state) query.set('state', input.state);
      if (input.limit !== undefined) query.set('limit', String(input.limit));
      if (input.offset !== undefined) query.set('offset', String(input.offset));
      const suffix = query.size ? `?${query}` : '';
      return request<readonly CbsDataQualityBatch[]>(`/cbs/data-quality/batches${suffix}`, { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent });
    },
    async tokenizePersonalData(input: CommandInput<TokenizeCommand>): Promise<TokenizedValue> {
      return genericCommandRequest<TokenizeCommand, TokenizedValue>('/tokenization/tokenize', input);
    },
    async tokenizePersonalDataBatch(input: CommandInput<TokenizeBatchCommand>): Promise<readonly TokenizedValue[]> {
      return genericCommandRequest<TokenizeBatchCommand, readonly TokenizedValue[]>('/tokenization/tokenize-batch', input);
    },
    async detokenizePersonalData(input: CommandInput<TokenOperationCommand>): Promise<DetokenizedValue> {
      return genericCommandRequest<TokenOperationCommand, DetokenizedValue>('/tokenization/detokenize', input);
    },
    async searchTokenizedData(input: CommandInput<TokenSearchCommand>): Promise<TokenizedValue> {
      return genericCommandRequest<TokenSearchCommand, TokenizedValue>('/tokenization/search', input);
    },
    async rotatePersonalDataToken(input: CommandInput<TokenOperationCommand>): Promise<TokenizedValue> {
      return genericCommandRequest<TokenOperationCommand, TokenizedValue>('/tokenization/rotate', input);
    },
    async createInvestmentProduct(input: CommandInput<CreateInvestmentProduct>): Promise<InvestmentProduct> {
      return genericCommandRequest<CreateInvestmentProduct, InvestmentProduct>('/products', input);
    },
    async createCustomerProfile(input: CommandInput<CustomerProfile>): Promise<CustomerProfile> {
      return genericCommandRequest<CustomerProfile, CustomerProfile>('/customers', input);
    },
    async identifyPurification(input: CommandInput<PurificationCase>): Promise<PurificationCase> {
      return genericCommandRequest<PurificationCase, PurificationCase>('/purifications', input);
    },
    async certifyOpeningBalances(input: CommandInput<OpeningBalanceCertificationCommand>): Promise<{ status: 'CERTIFIED' }> { return genericCommandRequest<OpeningBalanceCertificationCommand, { status: 'CERTIFIED' }>('/accounting/opening-balances/certifications', input); },
    async solveQuotationTarget(input: CommandInput<QuotationCommand>): Promise<unknown> { return genericCommandRequest<QuotationCommand, unknown>('/simulations', input); },
    async configureChargePolicy(input: CommandInput<ChargePolicy>): Promise<ChargePolicy> { return genericCommandRequest<ChargePolicy, ChargePolicy>('/charges/policies', input); },
    async importPoolCharge(input: CommandInput<PoolCharge>): Promise<PoolCharge> { return genericCommandRequest<PoolCharge, PoolCharge>('/charges/imports', input); },
    async evaluatePoolCharges(input: { poolId: string; businessDate: string; correlationId: string; traceparent?: string }): Promise<unknown> { const query = new URLSearchParams({ poolId: input.poolId, businessDate: input.businessDate }); return request<unknown>(`/charges/evaluation?${query}`, { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent }); },
    async listRecognizedIncome(input: { poolId: string; businessDate: string; correlationId: string; traceparent?: string }): Promise<readonly RecognizedIncome[]> { const query = new URLSearchParams({ poolId: input.poolId, businessDate: input.businessDate }); return request<readonly RecognizedIncome[]>(`/revenues?${query}`, { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent }); },
    async importRecognizedIncome(input: CommandInput<RecognizedIncome>): Promise<RecognizedIncome> { return genericCommandRequest<RecognizedIncome, RecognizedIncome>('/revenues/imports', input); },
    async adjustRecognizedIncome(input: CommandInput<IncomeAdjustment>): Promise<IncomeAdjustment> { return genericCommandRequest<IncomeAdjustment, IncomeAdjustment>('/revenues/adjustments', input); },
    async documentPurification(input: CommandInput<{ charityBeneficiaryId: string; shariaDecisionReference: string }> & { purificationId: string }): Promise<void> {
      await genericCommandRequest<{ charityBeneficiaryId: string; shariaDecisionReference: string }, unknown>(`/purifications/${encodeURIComponent(input.purificationId)}/document`, input);
    },
    async payPurification(input: CommandInput<{ amount: string; evidenceId: string }> & { purificationId: string }): Promise<void> {
      await genericCommandRequest<{ amount: string; evidenceId: string }, unknown>(`/purifications/${encodeURIComponent(input.purificationId)}/payments`, input);
    },
    async getPurificationStatement(input: { poolId: string; from: string; to: string; correlationId: string; traceparent?: string }): Promise<PurificationStatement> {
      const query = new URLSearchParams({ poolId: input.poolId, from: input.from, to: input.to });
      return request<PurificationStatement>(`/purifications/statement?${query}`, { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent });
    },
    async createInvestmentSubscription(input: CommandInput<CreateInvestmentSubscription>): Promise<InvestmentSubscription> {
      return genericCommandRequest<CreateInvestmentSubscription, InvestmentSubscription>('/investment-accounts/subscriptions', input);
    },
    async transitionInvestmentSubscription(input: CommandInput<InvestmentSubscriptionAction> & { accountId: string }): Promise<InvestmentSubscription> {
      return genericCommandRequest<InvestmentSubscriptionAction, InvestmentSubscription>(`/investment-accounts/subscriptions/${encodeURIComponent(input.accountId)}/actions`, input);
    },
    async getCustomerProfile(input: { customerId: string; correlationId: string; traceparent?: string }): Promise<CustomerProfile> {
      return request<CustomerProfile>(`/customers/${encodeURIComponent(input.customerId)}`, { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent });
    },
    async addCustomerRestriction(input: CommandInput<LegalRestriction> & { customerId: string }): Promise<void> {
      await genericCommandRequest<LegalRestriction, unknown>(`/customers/${encodeURIComponent(input.customerId)}/restrictions`, input);
    },
    async liftCustomerRestriction(input: CommandInput<{ liftedAt: string }> & { customerId: string; restrictionId: string }): Promise<CustomerProfile> {
      return genericCommandRequest<{ liftedAt: string }, CustomerProfile>(`/customers/${encodeURIComponent(input.customerId)}/restrictions/${encodeURIComponent(input.restrictionId)}/lift`, input);
    },
    async getInvestmentProduct(input: { productId: string; correlationId: string; traceparent?: string }): Promise<InvestmentProduct> {
      return request<InvestmentProduct>(`/products/${encodeURIComponent(input.productId)}`, { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent });
    },
    async createInvestmentPool(input: CommandInput<CreateInvestmentPool>): Promise<InvestmentPool> {
      return genericCommandRequest<CreateInvestmentPool, InvestmentPool>('/investment-pools', input);
    },
    async getInvestmentPool(input: { poolId: string; correlationId: string; traceparent?: string }): Promise<InvestmentPool> {
      return request<InvestmentPool>(`/investment-pools/${encodeURIComponent(input.poolId)}`, { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent });
    },
    async addInvestmentPoolFunding(input: CommandInput<PoolFundingSource> & { poolId: string }): Promise<InvestmentPool> {
      return genericCommandRequest<PoolFundingSource, InvestmentPool>(`/investment-pools/${encodeURIComponent(input.poolId)}/funding-sources`, input);
    },
    async transitionInvestmentPool(input: Omit<CommandInput<never>, 'command'> & { poolId: string; action: 'activate' | 'suspend' | 'close' }): Promise<InvestmentPool> {
      return request<InvestmentPool>(`/investment-pools/${encodeURIComponent(input.poolId)}/${input.action}`, { method: 'POST', correlationId: input.correlationId, idempotencyKey: input.idempotencyKey, traceparent: input.traceparent, body: '{}' });
    },
    async simulateAssetAllocation(input: CommandInput<AssetAllocation> & { poolId: string }): Promise<AssetAllocation> {
      return genericCommandRequest<AssetAllocation, AssetAllocation>(`/investment-pools/${encodeURIComponent(input.poolId)}/allocations/simulate`, input);
    },
    async allocateAssetToPool(input: CommandInput<AssetAllocation> & { poolId: string }): Promise<AssetAllocation> {
      return genericCommandRequest<AssetAllocation, AssetAllocation>(`/investment-pools/${encodeURIComponent(input.poolId)}/allocations`, input);
    },
    async getAssetAllocationHistory(input: { assetId: string; asOf?: string; correlationId: string; traceparent?: string }): Promise<readonly AssetAllocation[]> {
      const query = input.asOf ? `?${new URLSearchParams({ asOf: input.asOf })}` : '';
      return request<readonly AssetAllocation[]>(`/investment-pools/assets/${encodeURIComponent(input.assetId)}/allocations${query}`, { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent });
    },
    async listAssetAnomalies(input: { assetId: string; correlationId: string; traceparent?: string }): Promise<readonly AssetAnomaly[]> {
      return request<readonly AssetAnomaly[]>(`/investment-pools/assets/${encodeURIComponent(input.assetId)}/anomalies`, { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent });
    },
    async reportAssetAnomaly(input: CommandInput<AssetAnomaly> & { assetId: string }): Promise<AssetAnomaly> {
      return genericCommandRequest<AssetAnomaly, AssetAnomaly>(`/investment-pools/assets/${encodeURIComponent(input.assetId)}/anomalies`, input);
    },
    async resolveAssetAnomaly(input: CommandInput<{ resolvedAt: string; resolutionEvidenceId: string }> & { assetId: string; anomalyId: string }): Promise<AssetAnomaly> {
      return genericCommandRequest<{ resolvedAt: string; resolutionEvidenceId: string }, AssetAnomaly>(`/investment-pools/assets/${encodeURIComponent(input.assetId)}/anomalies/${encodeURIComponent(input.anomalyId)}/resolve`, input);
    },
    async recordPoolComposition(input: CommandInput<PoolCompositionInput> & { poolId: string }): Promise<PoolCompositionSnapshot> {
      return genericCommandRequest<PoolCompositionInput, PoolCompositionSnapshot>(`/investment-pools/${encodeURIComponent(input.poolId)}/compositions`, input);
    },
    async getPoolComposition(input: { poolId: string; businessDate: string; correlationId: string; traceparent?: string }): Promise<PoolCompositionSnapshot> {
      return request<PoolCompositionSnapshot>(`/investment-pools/${encodeURIComponent(input.poolId)}/compositions/${encodeURIComponent(input.businessDate)}`, { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent });
    },
    async transitionInvestmentProduct(input: CommandInput<ProductTransitionCommand> & { productId: string; action: 'validate' | 'publish' | 'suspend' | 'resume' | 'close' }): Promise<InvestmentProduct> {
      return genericCommandRequest<ProductTransitionCommand, InvestmentProduct>(`/products/${encodeURIComponent(input.productId)}/${input.action}`, input);
    },
    async simulateProductTerms(input: { productId: string; command: ProductTermsDraft; correlationId: string; idempotencyKey: string; traceparent?: string }): Promise<ProductTermsSimulation> {
      return request<ProductTermsSimulation>(`/products/${encodeURIComponent(input.productId)}/terms/simulate`, { method: 'POST', correlationId: input.correlationId, idempotencyKey: input.idempotencyKey, traceparent: input.traceparent, body: JSON.stringify(input.command) });
    },
    async createProductTermsDraft(input: CommandInput<ProductTermsDraft> & { productId: string }): Promise<ProductTerms> {
      return genericCommandRequest<ProductTermsDraft, ProductTerms>(`/products/${encodeURIComponent(input.productId)}/terms`, input);
    },
    async publishProductTerms(input: CommandInput<PublishProductTerms> & { productId: string; termsVersionId: string }): Promise<ProductTerms> {
      return genericCommandRequest<PublishProductTerms, ProductTerms>(`/products/${encodeURIComponent(input.productId)}/terms/${encodeURIComponent(input.termsVersionId)}/publish`, input);
    },
    async createComplianceReference(input: CommandInput<CreateComplianceReference>): Promise<ComplianceReference> {
      return genericCommandRequest<CreateComplianceReference, ComplianceReference>('/products/compliance-references', input);
    },
    async listProductReferences(input: { productId: string; correlationId: string; traceparent?: string }): Promise<readonly ProductReference[]> {
      return request<readonly ProductReference[]>(`/products/${encodeURIComponent(input.productId)}/references`, { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent });
    },
    async associateProductReference(input: CommandInput<AssociateProductReference> & { productId: string }): Promise<void> {
      await genericCommandRequest<AssociateProductReference, unknown>(`/products/${encodeURIComponent(input.productId)}/references`, input);
    },
    async arbitrateProductCompliance(input: CommandInput<ComplianceArbitration> & { productId: string }): Promise<void> {
      await genericCommandRequest<ComplianceArbitration, unknown>(`/products/${encodeURIComponent(input.productId)}/compliance-arbitrations`, input);
    },
    async getApiStatus(input: { correlationId: string; traceparent?: string }): Promise<ApiStatus> {
      return request<ApiStatus>('/', {
        method: 'GET',
        correlationId: input.correlationId,
        traceparent: input.traceparent,
      });
    },
    async getEffectiveCurrency(input: {
      code: string;
      businessDate: string;
      correlationId: string;
      traceparent?: string;
    }): Promise<CurrencyDefinition> {
      const query = new URLSearchParams({ businessDate: input.businessDate });
      return request<CurrencyDefinition>(
        `/reference-data/currencies/${encodeURIComponent(input.code)}?${query}`,
        { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent },
      );
    },
    async getEffectiveRegulatoryRule(input: { ruleCode: string; businessDate: string; correlationId: string; traceparent?: string }): Promise<RegulatoryRule> {
      const query = new URLSearchParams({ businessDate: input.businessDate });
      return request<RegulatoryRule>(`/reference-data/regulatory-rules/${encodeURIComponent(input.ruleCode)}?${query}`, { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent });
    },
    async getInvestmentAccountSnapshot(input: {
      accountId: string;
      businessDate: string;
      correlationId: string;
      traceparent?: string;
    }): Promise<InvestmentAccountSnapshot> {
      const query = new URLSearchParams({ businessDate: input.businessDate });
      return request<InvestmentAccountSnapshot>(
        `/investment-accounts/${encodeURIComponent(input.accountId)}?${query}`,
        { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent },
      );
    },
    async getCalculationRun(input: {
      runId: string;
      correlationId: string;
      traceparent?: string;
    }): Promise<CalculationRun> {
      return request<CalculationRun>(
        `/calculations/${encodeURIComponent(input.runId)}`,
        { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent },
      );
    },
    async controlCalculationRun(input: WorkflowInput & { runId: string }): Promise<WorkflowTransition> {
      return workflowRequest(`/calculations/${encodeURIComponent(input.runId)}/control`, input);
    },
    async approveCalculationRun(input: WorkflowInput & { runId: string }): Promise<WorkflowTransition> {
      return workflowRequest(`/calculations/${encodeURIComponent(input.runId)}/approve`, input);
    },
    async approveClosingPeriod(input: WorkflowInput & { closingId: string }): Promise<WorkflowTransition> {
      return workflowRequest(`/closings/${encodeURIComponent(input.closingId)}/approve`, input);
    },
    async rejectClosingPeriod(input: WorkflowInput & { closingId: string }): Promise<WorkflowTransition> {
      return workflowRequest(`/closings/${encodeURIComponent(input.closingId)}/reject`, input);
    },
    async postApprovedCalculation(input: WorkflowInput & { runId: string }): Promise<AccountingPostingResult> {
      return request<AccountingPostingResult>(
        `/accounting/runs/${encodeURIComponent(input.runId)}/post`,
        {
          method: 'POST', correlationId: input.correlationId, traceparent: input.traceparent,
          idempotencyKey: input.idempotencyKey, body: JSON.stringify(input.command),
        },
      );
    },
    async reversePostedJournal(input: {
      journalEntryId: string;
      command: JournalReversalCommand;
      correlationId: string;
      idempotencyKey: string;
      traceparent?: string;
    }): Promise<JournalReversalResult> {
      return request<JournalReversalResult>(
        `/accounting/journals/${encodeURIComponent(input.journalEntryId)}/reverse`,
        {
          method: 'POST', correlationId: input.correlationId, traceparent: input.traceparent,
          idempotencyKey: input.idempotencyKey, body: JSON.stringify(input.command),
        },
      );
    },
    async reconcileGeneralLedger(input: {
      command: ReconciliationCommand; correlationId: string; idempotencyKey: string; traceparent?: string;
    }): Promise<ReconciliationResult> {
      return request<ReconciliationResult>('/accounting/reconciliations', {
        method: 'POST', correlationId: input.correlationId, traceparent: input.traceparent,
        idempotencyKey: input.idempotencyKey, body: JSON.stringify(input.command),
      });
    },
    async emitAccountingEvent(input: CommandInput<AccountingEventCommand>): Promise<AccountingEventResult> {
      return genericCommandRequest<AccountingEventCommand, AccountingEventResult>('/accounting/events', input);
    },
    async acknowledgeAccountingEvent(input: CommandInput<AccountingAcknowledgementCommand> & { journalEntryId: string }): Promise<AccountingAcknowledgementResult> {
      return genericCommandRequest<AccountingAcknowledgementCommand, AccountingAcknowledgementResult>(`/accounting/journals/${encodeURIComponent(input.journalEntryId)}/acknowledgements`, input);
    },
    async submitShariaReview(input: CommandInput<ShariaReviewSubmission>): Promise<ShariaReviewTransition> {
      return commandRequest('/compliance/sharia-reviews', input);
    },
    async reviewShariaCase(input: CommandInput<ShariaOpinion> & { reviewId: string }): Promise<ShariaReviewTransition> {
      return commandRequest(`/compliance/sharia-reviews/${encodeURIComponent(input.reviewId)}/review`, input);
    },
    async decideShariaCase(input: CommandInput<ShariaDecision> & { reviewId: string }): Promise<ShariaReviewTransition> {
      return commandRequest(`/compliance/sharia-reviews/${encodeURIComponent(input.reviewId)}/decide`, input);
    },
    async calculateDcr(input: CommandInput<DcrCalculationCommand>): Promise<DcrCalculationResult> {
      return genericCommandRequest<DcrCalculationCommand, DcrCalculationResult>('/risk/dcr-calculations', input);
    },
    async runStressScenario(input: CommandInput<StressScenarioCommand>): Promise<StressScenarioResult> {
      return genericCommandRequest<StressScenarioCommand, StressScenarioResult>('/risk/stress-scenarios', input);
    },
    async getPublishedRiskDashboard(input: { poolId: string; correlationId: string; traceparent?: string }): Promise<PublishedRiskDashboard> {
      return request<PublishedRiskDashboard>(`/risk/dashboard/${encodeURIComponent(input.poolId)}`, { method: 'GET', correlationId: input.correlationId, traceparent: input.traceparent });
    },
    async generateRegulatoryReport(input: CommandInput<RegulatoryReportGeneration>): Promise<GeneratedRegulatoryReport> {
      return genericCommandRequest<RegulatoryReportGeneration, GeneratedRegulatoryReport>('/reporting/regulatory-reports/generate', input);
    },
    async createSecureExport(input: CommandInput<CreateSecureExport>): Promise<SecureExportTransition> {
      return genericCommandRequest<CreateSecureExport, SecureExportTransition>('/reporting/exports', input);
    },
    async approveSecureExport(input: Omit<CommandInput<never>, 'command'> & { exportId: string }): Promise<SecureExportApproval> {
      return request<SecureExportApproval>(`/reporting/exports/${encodeURIComponent(input.exportId)}/approvals`, { method: 'POST', correlationId: input.correlationId, idempotencyKey: input.idempotencyKey, traceparent: input.traceparent, body: '{}' });
    },
    async generateSecureExport(input: CommandInput<SecureExportGeneration> & { exportId: string }): Promise<GeneratedSecureExport> {
      return genericCommandRequest<SecureExportGeneration, GeneratedSecureExport>(`/reporting/exports/${encodeURIComponent(input.exportId)}/generation`, input);
    },
    async publishRegulatoryReport(input: CommandInput<RegulatoryReportPublication> & { regulatoryReportId: string }): Promise<RegulatoryReportTransition> {
      return genericCommandRequest<RegulatoryReportPublication, RegulatoryReportTransition>(
        `/reporting/regulatory-reports/${encodeURIComponent(input.regulatoryReportId)}/publish`, input,
      );
    },
    async approvePoolOperation(input: {
      poolId: string;
      command: ApprovePoolOperationCommand;
      correlationId: string;
      idempotencyKey: string;
      traceparent?: string;
    }): Promise<ApprovedPoolOperation> {
      return request<ApprovedPoolOperation>(
        `/pools/${encodeURIComponent(input.poolId)}/operations/approve`,
        {
          method: 'POST',
          correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey,
          traceparent: input.traceparent,
          body: JSON.stringify(input.command),
        },
      );
    },
  };

  async function workflowRequest(
    path: string,
    input: WorkflowInput,
  ): Promise<WorkflowTransition> {
    return request<WorkflowTransition>(path, {
      method: 'POST', correlationId: input.correlationId, traceparent: input.traceparent,
      idempotencyKey: input.idempotencyKey, body: JSON.stringify(input.command),
    });
  }

  async function commandRequest<TCommand>(path: string, input: CommandInput<TCommand>): Promise<ShariaReviewTransition> {
    return request<ShariaReviewTransition>(path, {
      method: 'POST', correlationId: input.correlationId, traceparent: input.traceparent,
      idempotencyKey: input.idempotencyKey, body: JSON.stringify(input.command),
    });
  }

  async function genericCommandRequest<TCommand, TResult>(path: string, input: CommandInput<TCommand>): Promise<TResult> {
    return request<TResult>(path, {
      method: 'POST', correlationId: input.correlationId, traceparent: input.traceparent,
      idempotencyKey: input.idempotencyKey, body: JSON.stringify(input.command),
    });
  }

  async function request<T>(
    path: string,
    input: {
      method: 'GET' | 'POST';
      correlationId: string;
      traceparent?: string;
      idempotencyKey?: string;
      body?: string;
    },
  ): Promise<T> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${await options.accessToken()}`,
      'x-correlation-id': input.correlationId,
    };
    if (input.body) headers['content-type'] = 'application/json';
    if (input.idempotencyKey) headers['idempotency-key'] = input.idempotencyKey;
    if (input.traceparent) headers['traceparent'] = input.traceparent;
    const response = await fetchImplementation(`${options.baseUrl}/api${path}`, {
      method: input.method,
      headers,
      body: input.body,
    });
    const body: unknown = await response.json();
    if (!response.ok) throw new PmsApiProblem(body as Problem);
    return body as T;
  }
}

interface CommandInput<TCommand> {
  command: TCommand;
  correlationId: string;
  idempotencyKey: string;
  traceparent?: string;
}

interface WorkflowInput {
  command: WorkflowApprovalCommand;
  correlationId: string;
  idempotencyKey: string;
  traceparent?: string;
}
