// Generated from contracts/openapi/pms-api.v1.json. Do not edit.
export const apiVersion = "1.0.0" as const;

export const operationIds = [
  "certifyOpeningBalances",
  "solveQuotationTarget",
  "identifyPurification",
  "documentPurification",
  "payPurification",
  "getPurificationStatement",
  "configureChargePolicy",
  "importPoolCharge",
  "evaluatePoolCharges",
  "listRecognizedIncome",
  "importRecognizedIncome",
  "adjustRecognizedIncome",
  "listAssetAnomalies",
  "reportAssetAnomaly",
  "resolveAssetAnomaly",
  "simulateAssetAllocation",
  "allocateAssetToPool",
  "getAssetAllocationHistory",
  "recordPoolComposition",
  "getPoolComposition",
  "createInvestmentPool",
  "getInvestmentPool",
  "transitionInvestmentPool",
  "addInvestmentPoolFunding",
  "createInvestmentSubscription",
  "transitionInvestmentSubscription",
  "createCustomerProfile",
  "getCustomerProfile",
  "addCustomerRestriction",
  "liftCustomerRestriction",
  "listCbsDataQualityBatches",
  "tokenizePersonalData",
  "tokenizePersonalDataBatch",
  "detokenizePersonalData",
  "searchTokenizedData",
  "rotatePersonalDataToken",
  "createInvestmentProduct",
  "getInvestmentProduct",
  "transitionInvestmentProduct",
  "simulateProductTerms",
  "createProductTermsDraft",
  "publishProductTerms",
  "createComplianceReference",
  "listProductReferences",
  "associateProductReference",
  "arbitrateProductCompliance",
  "getApiStatus",
  "getEffectiveCurrency",
  "getEffectiveRegulatoryRule",
  "getInvestmentAccountSnapshot",
  "getCalculationRun",
  "controlCalculationRun",
  "approveCalculationRun",
  "rejectClosingPeriod",
  "approveClosingPeriod",
  "postApprovedCalculation",
  "reversePostedJournal",
  "requestDocumentArchive",
  "getDocumentArchiveRequest",
  "getAuditTrail",
  "emitAccountingEvent",
  "acknowledgeAccountingEvent",
  "reconcileGeneralLedger",
  "submitShariaReview",
  "reviewShariaCase",
  "decideShariaCase",
  "getPublishedRiskDashboard",
  "calculateDcr",
  "runStressScenario",
  "getTenorYieldCurve",
  "generateHistoricalYieldForecast",
  "getProfitExplanation",
  "createPlanningScenario",
  "transitionPlanningScenario",
  "getAudienceDashboard",
  "createSecureExport",
  "approveSecureExport",
  "generateSecureExport",
  "generateRegulatoryReport",
  "publishRegulatoryReport",
  "createExceptionCase",
  "transitionExceptionCase",
  "approvePoolOperation"
] as const;

export type PurificationCase = {
  readonly purificationId: string;
  readonly incomeId: string;
  readonly poolId: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly amount: string;
  readonly reason: string;
  readonly charityBeneficiaryId?: string;
  readonly shariaDecisionReference?: string;
  readonly status: string;
  readonly paidAmount: string;
};

export type ChargePolicy = {
  readonly policyId: string;
  readonly categoryCode: string;
  readonly responsibility: string;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly shariaApprovalId?: string;
  readonly version: number;
};

export type PoolCharge = {
  readonly chargeId: string;
  readonly poolId: string;
  readonly categoryCode: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly amount: string;
  readonly sourceReference: string;
};

export type RecognizedIncome = {
  readonly incomeId: string;
  readonly sourceSystem: string;
  readonly sourceReference: string;
  readonly assetId: string;
  readonly poolId: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly amount: string;
  readonly cashStatus: string;
  readonly realizationStatus: string;
  readonly incomeType: string;
};

export type IncomeAdjustment = {
  readonly adjustmentId: string;
  readonly incomeId: string;
  readonly amount: string;
  readonly reason: string;
  readonly approvalId: string;
  readonly businessDate: string;
  readonly actorId: string;
};

export type AssetAnomaly = {
  readonly anomalyId: string;
  readonly assetId?: string;
  readonly kind: string;
  readonly reason: string;
  readonly detectedAt: string;
  readonly status: string;
  readonly resolvedAt?: string;
  readonly resolutionEvidenceId?: string;
};

export type AssetAllocation = {
  readonly allocationId: string;
  readonly assetId: string;
  readonly poolId?: string;
  readonly percentage: string;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly justification: string;
  readonly approvalId?: string;
};

export type CompositionBucket = {
  readonly bucket: string;
  readonly amount: string;
};

export type PoolCompositionInput = {
  readonly businessDate: string;
  readonly currency: string;
  readonly bankEquity: string;
  readonly iahRestricted: string;
  readonly iahUnrestricted: string;
  readonly investedAmount: string;
  readonly maturityGaps: readonly CompositionBucket[];
  readonly currencyGaps: readonly CompositionBucket[];
  readonly runId?: string;
};

export type PoolCompositionSnapshot = PoolCompositionInput & {
  readonly poolId: string;
  readonly totalResources: string;
  readonly uninvestedLiquidity: string;
  readonly checksumSha256: string;
  readonly certified: boolean;
};

export type PoolFundingSource = {
  readonly sourceId: string;
  readonly type: string;
  readonly amount: string;
  readonly mandateAssetCodes: readonly string[];
};

export type CreateInvestmentPool = {
  readonly poolId: string;
  readonly displayName: string;
  readonly currency: string;
  readonly strategyCode: string;
  readonly validFrom: string;
  readonly validUntil?: string;
  readonly eligibleAssetCodes: readonly string[];
  readonly mudaribProfitShare: string;
};

export type InvestmentPool = CreateInvestmentPool & {
  readonly status: string;
  readonly fundingSources: readonly PoolFundingSource[];
};

export type CreateInvestmentSubscription = {
  readonly accountId: string;
  readonly customerId: string;
  readonly productId: string;
  readonly productTermsVersionId: string;
  readonly contractVersion: string;
  readonly investorNisba: string;
  readonly bankNisba: string;
  readonly currency: string;
  readonly maturityDate?: string;
};

export type InvestmentSubscriptionAction = {
  readonly type: string;
  readonly businessDate: string;
  readonly amount?: string;
  readonly reason?: string;
  readonly maturityDate?: string;
  readonly caseReference?: string;
  readonly acceptedAt?: string;
  readonly nonGuaranteeAccepted?: boolean;
  readonly profitSharingMethodAccepted?: boolean;
};

export type InvestmentSubscription = CreateInvestmentSubscription & {
  readonly status: string;
  readonly openedOn?: string;
  readonly closedOn?: string;
};

export type LegalRestriction = {
  readonly restrictionId: string;
  readonly kind: string;
  readonly reason: string;
  readonly effectiveFrom: string;
  readonly liftedAt?: string;
};

export type CustomerProfile = {
  readonly customerId: string;
  readonly identityToken: string;
  readonly beneficialOwnerTokens: readonly string[];
  readonly representativeTokens: readonly string[];
  readonly segment: string;
  readonly kycStatus: string;
  readonly legalForm: string;
  readonly sectorCode: string;
  readonly branchCode: string;
  readonly restrictions: readonly LegalRestriction[];
};

export type CbsDataQualityBatch = {
  readonly batchId: string;
  readonly sourceCode: string;
  readonly businessDate: string;
  readonly flowType: string;
  readonly sequenceNumber: number;
  readonly state: string;
  readonly manifestRowCount?: number | null;
  readonly manifestBalanceTotal?: string | null;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly lastControlAt?: string | null;
};

export type TokenizeCommand = {
  readonly value: string;
  readonly dataClass: PersonalDataClass;
  readonly purpose: string;
};

export type TokenizeBatchCommand = {
  readonly values: readonly string[];
  readonly dataClass: PersonalDataClass;
  readonly purpose: string;
};

export type TokenOperationCommand = {
  readonly token: string;
  readonly purpose: string;
};

export type TokenSearchCommand = {
  readonly searchDigestSha256: string;
  readonly dataClass: PersonalDataClass;
  readonly purpose: string;
};

export type PersonalDataClass = string;

export type TokenizedValue = {
  readonly token: string;
  readonly dataClass: PersonalDataClass;
  readonly vaultKeyVersion: string;
};

export type DetokenizedValue = {
  readonly value: string;
};

export type CreateInvestmentProduct = {
  readonly code: string;
  readonly name: string;
  readonly investorNisba: string;
  readonly bankNisba: string;
  readonly shariaReference?: string;
};

export type ProductTransitionCommand = {
  readonly justification: string;
};

export type InvestmentProduct = {
  readonly productId: string;
  readonly code: string;
  readonly name: string;
  readonly investorNisba: string;
  readonly bankNisba: string;
  readonly shariaReference?: string;
  readonly validatedBy?: string;
  readonly status: string;
};

export type ProductTermsDraft = {
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly investorNisba: string;
  readonly bankNisba: string;
  readonly indicativeTargetRate?: string;
};

export type ProductTermsSimulation = {
  readonly simulationChecksumSha256: string;
  readonly valid: true;
  readonly notice: string;
};

export type PublishProductTerms = {
  readonly businessDate: string;
  readonly simulationChecksumSha256: string;
  readonly retroactiveApprovalId?: string;
  readonly justification: string;
};

export type ProductTerms = {
  readonly termsVersionId: string;
  readonly productId: string;
  readonly version: number;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly investorNisba: string;
  readonly bankNisba: string;
  readonly indicativeTargetRate?: string;
  readonly status: string;
  readonly simulationChecksumSha256?: string;
  readonly retroactiveApprovalId?: string;
  readonly createdBy: string;
};

export type CreateComplianceReference = {
  readonly source: string;
  readonly referenceCode: string;
  readonly version: string;
  readonly title: string;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
};

export type ComplianceReference = {
  readonly referenceId: string;
  readonly source: string;
  readonly referenceCode: string;
  readonly version: string;
  readonly title: string;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly createdBy: string;
};

export type ProductReference = {
  readonly referenceId: string;
  readonly source: string;
  readonly referenceCode: string;
  readonly version: string;
  readonly title: string;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly createdBy: string;
  readonly kind: string;
  readonly associatedAt: string;
};

export type AssociateProductReference = {
  readonly referenceId: string;
  readonly kind: string;
};

export type RegulatoryRule = {
  readonly ruleCode: string;
  readonly version: number;
  readonly authority: string;
  readonly legalReference: string;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly parameters: {

};
};

export type ComplianceArbitration = {
  readonly selectedReferenceId: string;
  readonly rejectedReferenceId: string;
  readonly rationale: string;
};

export type ApiStatus = {
  readonly message: string;
};

export type CurrencyDefinition = {
  readonly code: string;
  readonly name: string;
  readonly fractionDigits: number;
  readonly validFrom: string;
  readonly validUntil?: string;
};

export type InvestmentPosition = {
  readonly businessDate: string;
  readonly valueDate: string;
  readonly balance: string;
  readonly currency: string;
};

export type InvestmentAccountSnapshot = {
  readonly accountId: string;
  readonly productCode: string;
  readonly currency: string;
  readonly openedOn: string;
  readonly status: string;
  readonly closedOn?: string;
  readonly position?: InvestmentPosition;
};

export type CalculationAllocation = {
  readonly participantId: string;
  readonly amount: string;
  readonly currency: string;
};

export type CalculationRun = {
  readonly runId: string;
  readonly poolId: string;
  readonly businessDate: string;
  readonly rulesVersion: string;
  readonly engineVersion: string;
  readonly status: string;
  readonly inputChecksumSha256?: string;
  readonly outputChecksumSha256?: string;
  readonly distributableAmount?: string;
  readonly currency?: string;
  readonly allocations: readonly CalculationAllocation[];
};

export type WorkflowApprovalCommand = {
  readonly justification: string;
};

export type WorkflowTransition = {
  readonly state: string;
};

export type AccountingPostingResult = {
  readonly state: "POSTED";
  readonly journalEntryId: string;
};

export type JournalReversalCommand = {
  readonly justification: string;
  readonly reversalBusinessDate: string;
};

export type JournalReversalResult = {
  readonly state: "POSTED";
  readonly reversalJournalEntryId: string;
};

export type DocumentArchiveRequestCommand = {
  readonly objectKey: string;
  readonly businessType: string;
  readonly businessId: string;
  readonly classification: string;
  readonly evidentiary: boolean;
};

export type DocumentArchiveQueued = {
  readonly requestId: string;
  readonly status: string;
};

export type DocumentArchiveRequest = DocumentArchiveRequestCommand & {
  readonly requestId: string;
  readonly status: string;
  readonly checksumSha256?: string;
  readonly paperlessDocumentId?: number;
  readonly wormObjectKey?: string;
  readonly createdAt: string;
  readonly archivedAt?: string;
};

export type AuditEvent = {
  readonly auditEventId: string;
  readonly previousHash?: string;
  readonly eventHash: string;
  readonly signingKeyId: string;
  readonly signatureBase64: string;
  readonly correlationId: string;
  readonly actorId: string;
  readonly technicalIdentity: string;
  readonly sessionId?: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly outcome: string;
  readonly businessDate: string;
  readonly occurredAt: string;
  readonly sourceApplication: string;
  readonly sourceAddress?: string;
  readonly justification?: string;
  readonly runId?: string;
  readonly batchId?: string;
  readonly documentReferenceId?: string;
  readonly authorizedChanges?: {

};
};

export type AuditTrail = {
  readonly events: readonly AuditEvent[];
  readonly integrity: "HASH_CHAIN";
  readonly chainValid: boolean;
  readonly verifiedCount: number;
  readonly brokenAtEventId?: string;
};

export type AccountingJournalLine = {
  readonly accountCode: string;
  readonly currency: string;
  readonly debit: string;
  readonly credit: string;
  readonly participantId?: string | null;
};

export type AccountingEventCommand = {
  readonly runId: string;
  readonly poolId: string;
  readonly productId: string;
  readonly eventType: string;
  readonly eventId: string;
  readonly entityId: string;
  readonly businessDate: string;
  readonly currencyScale: number;
  readonly lines: readonly AccountingJournalLine[];
};

export type AccountingEventResult = {
  readonly journalEntryId: string;
  readonly acknowledgementState: "PENDING";
};

export type AccountingAcknowledgementCommand = {
  readonly action: string;
  readonly externalReference: string;
  readonly reason?: string;
};

export type AccountingAcknowledgementResult = {
  readonly acknowledgementState: string;
};

export type ReconciliationCommand = {
  readonly businessDate: string;
  readonly currency: string;
  readonly generalLedgerAmount: string;
  readonly sourceReference: string;
  readonly sourceChecksumSha256: string;
};

export type ReconciliationResult = {
  readonly reconciliationId: string;
  readonly state: string;
  readonly difference: string;
};

export type ShariaReviewSubmission = {
  readonly resourceType: string;
  readonly resourceId: string;
};

export type ShariaOpinion = {
  readonly opinion: string;
};

export type ShariaDecision = {
  readonly decision: string;
  readonly justification: string;
  readonly evidenceDocumentId: string;
};

export type ShariaReviewTransition = {
  readonly reviewId: string;
  readonly state: string;
};

export type PublishedRiskDashboard = {
  readonly runId: string;
  readonly poolId: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly poolProfitRate: string;
  readonly distributedProfitRate: string;
  readonly yieldGap: string;
  readonly bankMargin: string;
  readonly totalResources: string;
  readonly investedAmount: string;
  readonly averageDurationDays: string | null;
  readonly assetConcentrationRate: string;
  readonly maturityGaps: readonly CompositionBucket[];
  readonly currencyGaps: readonly CompositionBucket[];
  readonly perCoverageRate: string;
  readonly irrCoverageRate: string;
  readonly dcrValue: string | null;
  readonly dcrState: string | null;
  readonly source: "LATEST_PUBLISHED_RUN";
  readonly dataQualityWarnings: readonly string[];
};

export type DcrCalculationCommand = {
  readonly poolId: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly capitalDurationAmount: string;
  readonly riskWeightedDurationAmount: string;
  readonly threshold: string;
  readonly formulaVersion: string;
  readonly inputChecksumSha256: string;
};

export type DcrCalculationResult = {
  readonly dcrCalculationId: string;
  readonly value: string;
  readonly threshold: string;
  readonly state: string;
};

export type StressShock = {
  readonly bucket: string;
  readonly basisPoints: number;
};

export type StressScenarioCommand = {
  readonly scenarioCode: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly baseAmount: string;
  readonly shocks: readonly StressShock[];
  readonly engineVersion: string;
  readonly inputChecksumSha256: string;
};

export type StressResultLine = {
  readonly bucket: string;
  readonly basisPoints: number;
  readonly stressedAmount: string;
  readonly impactAmount: string;
};

export type StressScenarioResult = {
  readonly stressScenarioId: string;
  readonly state: "COMPLETED";
  readonly results: readonly StressResultLine[];
};

export type CreateSecureExport = {
  readonly reportType: string;
  readonly format: string;
  readonly scope: string;
  readonly filters?: {

};
};

export type SecureExportTransition = {
  readonly exportId: string;
  readonly status: string;
};

export type SecureExportApproval = {
  readonly status: string;
};

export type ExportColumn = {
  readonly key: string;
  readonly label: string;
  readonly personalData?: boolean;
};

export type ExportDataset = {
  readonly columns: readonly ExportColumn[];
  readonly rows: readonly {

}[];
};

export type SecureExportGeneration = {
  readonly dataset: ExportDataset;
};

export type GeneratedSecureExport = {
  readonly exportId: string;
  readonly status: "GENERATED";
  readonly checksumSha256: string;
};

export type RegulatoryReportGeneration = {
  readonly reportType: string;
  readonly period: string;
};

export type RegulatoryReportSnapshot = {
  readonly period: string;
  readonly postedCalculationCount: number;
  readonly reconciliationVarianceCount: number;
  readonly dcrBreachCount: number;
  readonly approvedShariaReviewCount: number;
  readonly rejectedShariaReviewCount: number;
};

export type GeneratedRegulatoryReport = {
  readonly regulatoryReportId: string;
  readonly state: "GENERATED";
  readonly snapshot: RegulatoryReportSnapshot;
  readonly sourceChecksumSha256: string;
  readonly outputChecksumSha256: string;
};

export type RegulatoryReportPublication = {
  readonly evidenceDocumentId: string;
  readonly justification: string;
};

export type RegulatoryReportTransition = {
  readonly regulatoryReportId: string;
  readonly state: "PUBLISHED";
};

export type ApprovePoolOperationCommand = {
  readonly amount: string;
  readonly currency: string;
  readonly legalEntityId: string;
  readonly branchId: string;
  readonly workflowStatus: "PENDING_APPROVAL";
  readonly previousActorId?: string;
};

export type ApprovedPoolOperation = {
  readonly poolId: string;
  readonly status: "APPROVED";
  readonly amount: string;
  readonly currency: string;
};

export type TenorYieldCurvePoint = {
  readonly bucket: string;
  readonly financingAmount: string;
  readonly placementAmount: string;
  readonly gap: string;
  readonly servedYieldPercent: string;
};

export type TenorYieldCurve = {
  readonly poolId: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly closingId: string;
  readonly scope: string;
  readonly points: readonly TenorYieldCurvePoint[];
};

export type HistoricalYieldForecastPoint = {
  readonly month: string;
  readonly movingAveragePercent: string;
  readonly trendPercent: string;
  readonly forecastPercent: string;
};

export type HistoricalYieldForecast = {
  readonly forecastId: string;
  readonly method: "MOVING_AVERAGE_AND_LINEAR_TREND";
  readonly scope: "POOL";
  readonly complementsManualScenarios: true;
  readonly sourceChecksumSha256: string;
  readonly points: readonly HistoricalYieldForecastPoint[];
};

export type ProfitExplanationSource = {
  readonly accountId: string;
  readonly currency: string;
  readonly capitalInvested: string;
  readonly participationBase: string;
  readonly eligiblePeriod: {
  readonly from: string;
  readonly to: string;
};
  readonly weighting: string;
  readonly contractualRatio: string;
  readonly poolProfit: string;
  readonly allocatedShare: string;
  readonly reservesUsed: string;
  readonly taxAmount: string;
  readonly netPaid: string;
  readonly realizedRatePercent: string;
  readonly distributedRatePercent: string;
  readonly nonGuaranteedNotice: string;
  readonly lossExplanation: string | null;
  readonly mudaribNetShare?: string;
  readonly perClosingBalance?: string;
  readonly irrClosingBalance?: string;
  readonly lossAbsorptionCapacity?: string;
};

export type ProfitExplanation = {
  readonly runId: string;
  readonly accountId: string;
  readonly outputChecksumSha256: string;
  readonly view: string;
  readonly source: ProfitExplanationSource;
};

export type PlanningAssumptions = {
  readonly monthlyResourceGrowthPercent: string;
  readonly annualYieldPercent: string;
  readonly monthlyPlacementGrowthPercent: string;
};

export type CreatePlanningScenario = {
  readonly poolId: string;
  readonly kind: string;
  readonly version: number;
  readonly startMonth: string;
  readonly assumptions: PlanningAssumptions;
};

export type PlanningScenarioTransitionCommand = {
  readonly targetStatus: string;
};

export type PlanningScenarioTransition = {
  readonly scenarioId?: string;
  readonly status: string;
};

export type DashboardAudience = string;

export type DashboardItem = {
  readonly code: string;
  readonly value: {

} | string | number | boolean | null;
  readonly availability: string;
  readonly justification?: string;
};

export type AudienceDashboard = {
  readonly audience: DashboardAudience;
  readonly businessDate?: string;
  readonly generatedAt: string;
  readonly items: readonly DashboardItem[];
  readonly queryDurationMs: number;
  readonly requiredItemCount: number;
  readonly complete: true;
  readonly performanceBudgetMs: 3000;
};

export type CreateExceptionCase = {
  readonly sourceType: string;
  readonly sourceId: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly severity: string;
  readonly title: string;
  readonly description: string;
};

export type ExceptionTransitionCommand = {
  readonly targetStatus: string;
  readonly comment: string;
  readonly riskAcceptanceReference?: string;
};

export type ExceptionTransition = {
  readonly exceptionId?: string;
  readonly status: string;
};

export type Problem = {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly correlationId?: string;
};
