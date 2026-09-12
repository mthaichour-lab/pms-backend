# Graph Report - pms-backend  (2026-09-09)

## Corpus Check
- 506 files · ~94,634 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2714 nodes · 5700 edges · 161 communities (130 shown, 31 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 182 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5102f667`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PoolingController
- PersonalDataClass
- reference-data.module.ts
- compliance.module.ts
- reverse-posted-journal.ts
- perform-workflow-approval.ts
- ProductTermsState
- customer-profile.ts
- exceptions.module.ts
- schema.ts
- client.ts
- revenue.module.ts
- InvestmentProductState
- manage-product-references.ts
- ProductsController
- AssetAllocation
- cbs-ingestion.module.ts
- closing-worker/src/main.ts
- manage-regulatory-report.ts
- InvestmentProduct
- ingestion-worker/src/main.ts
- OutboxMessage
- scheduler/src/main.ts
- audit.module.ts
- manage-asset-quality.ts
- purification.ts
- pool-composition-snapshot.ts
- recognized-income.ts
- investment-pool.ts
- musharaka-allocation.ts
- SqlClient
- authorization-contracts.ts
- compilerOptions
- scripts
- ManageInvestmentPool
- dependencies
- InvestmentSubscription
- archive-document.ts
- app.module.ts
- HttpMetricsRegistry
- document-worker/src/main.ts
- moudaraba-allocation.ts
- PostgresDatabaseService
- compilerOptions
- real-dependencies.mjs
- rabbitmq-event-consumer.adapter.ts
- calculations.module.ts
- profit-explanation.ts
- compilerOptions
- manual-findings.schema.json
- PostgresInvestmentPositionPublicationRepository
- investment-accounts.module.ts
- worker-definitions.spec.ts
- InvestmentSubscriptionState
- investment-subscription.ts
- Money
- intergenerational-equity.ts
- products.module.ts
- reserve-movement.ts
- postgres-investment-account-query.repository.ts
- charge-policy.ts
- authorization.guard.ts
- manage-secure-export.ts
- documents.module.ts
- postgres-client.ts
- pms-api-client/package.json
- tsconfig.spec.json
- verify-seeds.mjs
- execute-calculation-step.ts
- InvestmentAccount
- postgres-data-quality-dashboard.repository.ts
- .action
- postgres-workflow-approval.repository.ts
- PurificationController
- RevenueController
- verify-sdk-coverage.mjs
- HealthController
- closing-workflow.ts
- engine/package.json
- devDependencies
- createPmsApiClient
- .approvePoolOperation
- PMS observability stack
- generate-sdk.mjs
- project.json
- manage-accounting-event.ts
- reporting.module.ts
- pooling.controller.ts
- jose
- verify-foundation.mjs
- verify-runtime.mjs
- Runbook de déploiement Docker
- package.json
- pms-api-client/tsconfig.json
- opentelemetry.ts
- planning-scenario.controller.ts
- ADR-016 DDD comme langage commun
- @nestjs/common
- OidcJwtGuard
- validate-contracts.mjs
- OpenTelemetry Collector
- ddd-boundaries.spec.ts
- api-runtime-smoke.mjs
- verify-vault.mjs
- Incident de clé privée OpenSSH
- Extraction additive
- WorkflowApprovalCommand
- Local PMS infrastructure
- PMS container runtime
- PMS database
- Local console alert receiver
- PMS Prometheus alert rules
- PMS Grafana dashboard provider
- Observability
- Audit de parité pms-platform
- Backend CI
- Publish API SDK
- pnpm Workspace
- reconcile-general-ledger.ts
- workflow-approval.module.ts
- certify-opening-balances.ts
- query-tenor-yield-curve.ts
- risk-alm.module.ts
- @opentelemetry/exporter-trace-otlp-proto
- balanced-journal.ts
- @opentelemetry/semantic-conventions
- execute-profit-calculation.ts
- .publish
- evaluate-parallel-run.mjs
- postgres-historical-yield-forecast.repository.ts
- ChargesController
- reflect-metadata
- accounting.module.ts
- batch-state.ts
- PostgresInvestmentPositionValidationRepository
- run-failover-drill.mjs
- RequireAuthorization
- TokenizationController
- PurificationCase
- queue-depth-scaler.mjs
- .get
- closing-governance.ts
- Q: Implémenter la certification des soldes d'ouverture migrés et bloquer le premier run réel
- evaluate-pentest.mjs
- verify-failover-evidence.mjs
- story-14-1-load-capacity.md
- story-14-2-pra-rpo-rto.md
- story-14-3-pentest.md
- story-14-4-parallel-run.md
- story-14-5-opening-balances.md
- CustomersController
- .generate
- WorkflowApprovalController
- ComplianceController
- ComplianceReference

## God Nodes (most connected - your core abstractions)
1. `RequireAuthorization()` - 93 edges
2. `AuthenticatedUserClaims` - 72 edges
3. `AuthenticatedUser` - 66 edges
4. `scripts` - 32 edges
5. `bootstrap()` - 27 edges
6. `SqlClient` - 27 edges
7. `PersonalDataClass` - 22 edges
8. `PostgresDatabaseService` - 21 edges
9. `OutboxMessage` - 21 edges
10. `InvestmentSubscription` - 21 edges

## Surprising Connections (you probably didn't know these)
- `bootstrap()` --calls--> `createPostgresPool()`  [EXTRACTED]
  apps/calculation-worker/src/main.ts → src/infrastructure/persistence/postgres-client.ts
- `bootstrap()` --calls--> `PostgresInboxRepository`  [EXTRACTED]
  apps/calculation-worker/src/main.ts → src/infrastructure/persistence/postgres-inbox.repository.ts
- `ClosingMessageHandler` --references--> `IdempotentConsumer`  [EXTRACTED]
  apps/closing-worker/src/closing-message-handler.ts → src/infrastructure/messaging/idempotent-consumer.ts
- `bootstrap()` --calls--> `createPostgresPool()`  [EXTRACTED]
  apps/closing-worker/src/main.ts → src/infrastructure/persistence/postgres-client.ts
- `bootstrap()` --calls--> `PostgresInboxRepository`  [EXTRACTED]
  apps/closing-worker/src/main.ts → src/infrastructure/persistence/postgres-inbox.repository.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Routage des signaux d'observabilité** — deploy_observability_otel_collector_opentelemetry_collector, deploy_observability_tempo_tempo, deploy_observability_prometheus_prometheus, deploy_observability_loki_loki [EXTRACTED 1.00]

## Communities (161 total, 31 thin omitted)

### Community 0 - "PoolingController"
Cohesion: 0.29
Nodes (8): PoolingController, Body, Controller, Get, Headers, Param, Post, Query

### Community 1 - "PersonalDataClass"
Cohesion: 0.07
Nodes (27): Inject, MANAGE_TOKENIZATION, HttpTokenVaultAdapter, assertContext(), assertDigest(), BlindIndex, DetokenizationAudit, EncryptedPayload (+19 more)

### Community 2 - "reference-data.module.ts"
Cohesion: 0.06
Nodes (35): ReferenceDataController, Controller, Get, Inject, Param, Query, GET_EFFECTIVE_CURRENCY, GET_EFFECTIVE_REGULATORY_RULE (+27 more)

### Community 3 - "compliance.module.ts"
Cohesion: 0.13
Nodes (12): Inject, ComplianceModule, Module, MANAGE_SHARIA_REVIEW, PostgresShariaReviewRepository, assertUuid(), ManageShariaReview, ShariaReviewRepository (+4 more)

### Community 4 - "reverse-posted-journal.ts"
Cohesion: 0.26
Nodes (5): PostgresAccountingReversalRepository, AccountingReversalRepository, JournalReversalCommand, PostedJournalSnapshot, ReversePostedJournal

### Community 5 - "perform-workflow-approval.ts"
Cohesion: 0.24
Nodes (3): Inject, PerformWorkflowApproval, claims

### Community 6 - "ProductTermsState"
Cohesion: 0.09
Nodes (21): assertRetroactiveApproval(), insertCommand(), lockAndFindCommand(), mapTerms(), PostgresProductTermsRepository, TermsRow, commandFor(), ManageProductTerms (+13 more)

### Community 7 - "customer-profile.ts"
Cohesion: 0.08
Nodes (19): Inject, MANAGE_CUSTOMER_PROFILE, PostgresCustomerProfileRepository, CustomerProfileRepository, ManageCustomerProfile, assertDate(), assertToken(), copy() (+11 more)

### Community 8 - "exceptions.module.ts"
Cohesion: 0.13
Nodes (14): Inject, ExceptionsModule, Module, MANAGE_EXCEPTION_CASE, PostgresExceptionCaseRepository, CreateExceptionCommand, ExceptionCaseRepository, ManageExceptionCase (+6 more)

### Community 9 - "schema.ts"
Cohesion: 0.04
Nodes (54): AccountingAcknowledgementResult, AccountingJournalLine, ApiStatus, apiVersion, ApprovedPoolOperation, ApprovePoolOperationCommand, AssetAllocation, AssetAnomaly (+46 more)

### Community 10 - "client.ts"
Cohesion: 0.04
Nodes (53): CommandInput, OpeningBalanceCertificationCommand, PmsApiClientOptions, QuotationCommand, AccountingAcknowledgementCommand, AccountingEventCommand, AccountingEventResult, AccountingPostingResult (+45 more)

### Community 11 - "revenue.module.ts"
Cohesion: 0.15
Nodes (9): MANAGE_CHARGE_MATRIX, MANAGE_PURIFICATION, MANAGE_RECOGNIZED_INCOME, PostgresChargeMatrixRepository, ChargeMatrixRepository, ManageChargeMatrix, ChargeEvaluation, ChargePolicy (+1 more)

### Community 12 - "InvestmentProductState"
Cohesion: 0.14
Nodes (13): insertCommand(), lockAndFindCommand(), mapRow(), PostgresInvestmentProductRepository, ProductRow, assertProductPublishable(), commandFor(), InvestmentProductRepository (+5 more)

### Community 13 - "manage-product-references.ts"
Cohesion: 0.12
Nodes (12): mapRow(), PostgresProductReferenceRepository, ReferenceRow, assertUuid(), ProductReferenceRepository, ProductReferenceView, compliancePriority(), ComplianceReferenceState (+4 more)

### Community 14 - "ProductsController"
Cohesion: 0.33
Nodes (7): ProductsController, Body, Controller, Get, Headers, Param, Post

### Community 15 - "AssetAllocation"
Cohesion: 0.13
Nodes (12): PostgresAssetAllocationRepository, AllocationPreconditions, AssetAllocationRepository, ManageAssetAllocation, AssetAllocation, date(), format(), scaled() (+4 more)

### Community 16 - "cbs-ingestion.module.ts"
Cohesion: 0.16
Nodes (10): CbsIngestionController, optionalInteger(), Controller, Get, Inject, Query, CbsIngestionModule, Module (+2 more)

### Community 17 - "closing-worker/src/main.ts"
Cohesion: 0.17
Nodes (12): ClosingMessageHandler, stringField(), bootstrap(), requiredEnvironment(), requiredQueue(), PostgresClosingControlRepository, ClosingControlRepository, ClosingRequest (+4 more)

### Community 18 - "manage-regulatory-report.ts"
Cohesion: 0.17
Nodes (10): Inject, canonicalJson(), PostgresRegulatoryReportRepository, sha256(), ManageRegulatoryReport, RegulatoryReportRepository, uuid(), assertPublishableReport() (+2 more)

### Community 19 - "InvestmentProduct"
Cohesion: 0.17
Nodes (5): InvestmentProduct, InvestmentProductStatus, isUuid(), toMillionths(), validateState()

### Community 20 - "ingestion-worker/src/main.ts"
Cohesion: 0.06
Nodes (40): CbsBatchMessageHandler, integerField(), stringField(), bootstrap(), nonNegativeIntegerEnvironment(), positiveIntegerEnvironment(), requiredEnvironment(), requiredQueue() (+32 more)

### Community 21 - "OutboxMessage"
Cohesion: 0.16
Nodes (12): CalculationMessageHandler, optionalRunKind(), stringField(), archivePayload(), DocumentMessageHandler, LandingStoragePort, IdempotentConsumer, InboxRepository (+4 more)

### Community 22 - "scheduler/src/main.ts"
Cohesion: 0.07
Nodes (19): ClosingGovernanceScheduler, bootstrap(), positiveIntegerEnvironment(), requiredEnvironment(), OutboxScheduler, EventPublisher, OutboxRepository, OutboxRelay (+11 more)

### Community 23 - "audit.module.ts"
Cohesion: 0.08
Nodes (26): AuditController, AuditEventWriter, Controller, Inject, AUDIT_EVENT_WRITER, QUERY_AUDIT_TRAIL, KmsHttpAuditSigner, KmsHttpAuditSignerOptions (+18 more)

### Community 24 - "manage-asset-quality.ts"
Cohesion: 0.13
Nodes (8): Inject, PostgresAssetQualityRepository, AssetQualityRepository, ManageAssetQuality, AssetAnomaly, AssetAnomalyKind, AssetAnomalyStatus, validateAssetAnomaly()

### Community 25 - "purification.ts"
Cohesion: 0.12
Nodes (13): mapCase(), PostgresPurificationRepository, ManagePurification, PurificationRepository, date(), decimal(), format(), PurificationCase (+5 more)

### Community 26 - "pool-composition-snapshot.ts"
Cohesion: 0.16
Nodes (11): PostgresPoolCompositionRepository, ManagePoolComposition, PoolCompositionRepository, composePoolSnapshot(), CompositionBucket, date(), decimal(), format() (+3 more)

### Community 27 - "recognized-income.ts"
Cohesion: 0.14
Nodes (13): PostgresRecognizedIncomeRepository, ManageRecognizedIncome, RecognizedIncomeRepository, date(), decimal(), IncomeAdjustment, IncomeCashStatus, IncomeRealizationStatus (+5 more)

### Community 28 - "investment-pool.ts"
Cohesion: 0.13
Nodes (10): copySource(), date(), FundingSourceType, InvestmentPool, money(), percent(), PoolStatus, validate() (+2 more)

### Community 29 - "musharaka-allocation.ts"
Cohesion: 0.06
Nodes (49): BANK_LIABILITY_CAUSES, classifyLossAbsorption(), decimal(), IrrAbsorptionPolicy, isBankLiabilityCause(), LossAbsorptionInput, LossAbsorptionResult, LossCause (+41 more)

### Community 30 - "SqlClient"
Cohesion: 0.13
Nodes (6): SqlClient, PostgresDocumentReferenceRepository, PostgresInboxRepository, mapOutboxRecord(), OutboxRow, PostgresOutboxRepository

### Community 31 - "authorization-contracts.ts"
Cohesion: 0.22
Nodes (15): compareUnsignedDecimals(), evaluateAccessGovernance(), evaluateAuthorization(), isUnsignedDecimal(), optionalTimestamp(), safeOptionalTimestamp(), timestamp(), AccessGovernanceEvaluation (+7 more)

### Community 32 - "compilerOptions"
Cohesion: 0.10
Nodes (20): tests/**/*.ts, compilerOptions, emitDecoratorMetadata, experimentalDecorators, forceConsistentCasingInFileNames, module, moduleResolution, noEmit (+12 more)

### Community 33 - "scripts"
Cohesion: 0.06
Nodes (32): scripts, build, contracts:check-sdk, contracts:generate-sdk, contracts:lint, database:verify, database:verify-seeds, deploy:verify (+24 more)

### Community 34 - "ManageInvestmentPool"
Cohesion: 0.19
Nodes (6): PostgresInvestmentPoolRepository, InvestmentPoolRepository, ManageInvestmentPool, FundingSource, InvestmentPoolState, state

### Community 35 - "dependencies"
Cohesion: 0.07
Nodes (27): amqplib, @nestjs/core, @nestjs/platform-express, @opentelemetry/auto-instrumentations-node, @opentelemetry/exporter-logs-otlp-proto, @opentelemetry/exporter-metrics-otlp-proto, @opentelemetry/resources, @opentelemetry/sdk-logs (+19 more)

### Community 36 - "InvestmentSubscription"
Cohesion: 0.25
Nodes (3): assertDate(), InvestmentSubscription, positive()

### Community 37 - "archive-document.ts"
Cohesion: 0.09
Nodes (23): ClamAvAntivirusAdapter, ClamAvOptions, scanWithClamAv(), normalizedBaseUrl(), toArrayBuffer(), WormHttpAdapter, WormHttpOptions, CbsLandingStoragePort (+15 more)

### Community 38 - "app.module.ts"
Cohesion: 0.07
Nodes (30): AccountingModule, Module, AppController, PoolOperationBody, Controller, Get, AppService, Injectable (+22 more)

### Community 39 - "HttpMetricsRegistry"
Cohesion: 0.16
Nodes (12): correlationFromHeader(), CorrelationMiddleware, HttpRequest, isTraceparent(), singleHeader(), Injectable, escapeLabel(), HttpMetricsRegistry (+4 more)

### Community 40 - "document-worker/src/main.ts"
Cohesion: 0.14
Nodes (15): bootstrap(), positiveIntegerEnvironment(), requiredEnvironment(), decodeFilename(), HttpLandingStorageAdapter, LandingHttpOptions, normalizedBaseUrl(), firstTask() (+7 more)

### Community 41 - "moudaraba-allocation.ts"
Cohesion: 0.06
Nodes (49): amount(), calculateDistributablePoolProfit(), DistributablePoolProfitInput, DistributablePoolProfitResult, ExactDecimal, formatted(), nonNegativeAmount(), positiveAmount() (+41 more)

### Community 42 - "PostgresDatabaseService"
Cohesion: 0.25
Nodes (5): DatabaseModule, Module, PostgresDatabaseService, Injectable, Global

### Community 43 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, emitDeclarationOnly, noEmit, outDir, rootDir, tsBuildInfoFile, types (+7 more)

### Community 44 - "real-dependencies.mjs"
Cohesion: 0.29
Nodes (5): apiUrl, correlationId, obtainAccessToken(), rabbitUrl, required()

### Community 45 - "rabbitmq-event-consumer.adapter.ts"
Cohesion: 0.23
Nodes (4): RabbitMqConsumerOptions, RabbitMqEventConsumer, requiredHeader(), toOutboxMessage()

### Community 46 - "calculations.module.ts"
Cohesion: 0.07
Nodes (32): CalculationsController, Controller, Get, Inject, Param, GET_CALCULATION_RUN, SOLVE_QUOTATION, SimulationsController (+24 more)

### Community 47 - "profit-explanation.ts"
Cohesion: 0.20
Nodes (7): Inject, PostgresProfitExplanationRepository, buildProfitExplanation(), ProfitExplanationOutput, renderProfitExplanation(), ProfitExplanationRepository, QueryProfitExplanation

### Community 48 - "compilerOptions"
Cohesion: 0.13
Nodes (14): **/*.spec.ts, compilerOptions, declaration, noEmit, outDir, rootDir, sourceMap, exclude (+6 more)

### Community 49 - "manual-findings.schema.json"
Cohesion: 0.05
Nodes (40): ACCEPTED_WITH_APPROVAL, CLOSED, CRITICAL, engagementReference, environment, findings, HIGH, id (+32 more)

### Community 51 - "investment-accounts.module.ts"
Cohesion: 0.30
Nodes (6): Inject, GET_INVESTMENT_ACCOUNT_SNAPSHOT, MANAGE_INVESTMENT_SUBSCRIPTION, GetInvestmentAccountSnapshot, ManageInvestmentSubscription, SubscriptionAction

### Community 52 - "worker-definitions.spec.ts"
Cohesion: 0.26
Nodes (8): calculationWorker, closingWorker, documentWorker, ingestionWorker, scheduledJobs, scheduler, defineWorker(), WorkerDefinition

### Community 53 - "InvestmentSubscriptionState"
Cohesion: 0.23
Nodes (5): PostgresInvestmentSubscriptionRepository, CustomerProfitRightsPolicy, InvestmentSubscriptionRepository, InvestmentSubscriptionState, SubscriptionEvent

### Community 54 - "investment-subscription.ts"
Cohesion: 0.22
Nodes (5): SubscriptionEventType, SubscriptionStatus, TermsAcceptance, validate(), input

### Community 55 - "Money"
Cohesion: 0.25
Nodes (3): allocateProportionally(), decimalToUnits(), Money

### Community 56 - "intergenerational-equity.ts"
Cohesion: 0.31
Nodes (12): analyzeIntergenerationalEquity(), assertScale(), ExactDecimal, formatted(), GenerationEquityView, IntergenerationalEquityResult, InvestorGenerationResult, nonNegative() (+4 more)

### Community 57 - "products.module.ts"
Cohesion: 0.28
Nodes (6): Inject, MANAGE_INVESTMENT_PRODUCT, MANAGE_PRODUCT_REFERENCES, MANAGE_PRODUCT_TERMS, ManageInvestmentProduct, ManageProductReferences

### Community 58 - "reserve-movement.ts"
Cohesion: 0.27
Nodes (7): authorizeReserveMovement(), calculateReserveMovement(), GovernedReserveMovement, GovernedReserveMovementInput, ReserveMovement, ReserveMovementKind, ReserveType

### Community 59 - "postgres-investment-account-query.repository.ts"
Cohesion: 0.27
Nodes (6): PostgresInvestmentAccountQueryRepository, SnapshotRow, InvestmentAccountQueryRepository, InvestmentAccountSnapshot, InvestmentAccountState, InvestmentAccountStatus

### Community 60 - "charge-policy.ts"
Cohesion: 0.35
Nodes (9): ChargeResponsibility, date(), evaluatePoolCharges(), format(), scaled(), uuid(), validateCharge(), validateChargePolicy() (+1 more)

### Community 61 - "authorization.guard.ts"
Cohesion: 0.13
Nodes (17): PUBLIC_ROUTE, AUTHORIZATION_POLICY, asOptionalString(), AuthorizationGuard, AuthorizationHttpRequest, isSafeMethod(), Injectable, authorizationSubjectFromClaims() (+9 more)

### Community 62 - "manage-secure-export.ts"
Cohesion: 0.14
Nodes (16): Inject, PostgresSecureExportRepository, CreateSecureExportCommand, ManageSecureExport, SecureExportRepository, validateAction(), approveMassExport(), assertExportDatasetSafe() (+8 more)

### Community 63 - "documents.module.ts"
Cohesion: 0.09
Nodes (21): DocumentsController, Body, Controller, Get, Headers, Inject, Param, Post (+13 more)

### Community 64 - "postgres-client.ts"
Cohesion: 0.42
Nodes (5): migrate(), requiredEnvironment(), requiredEnvironment(), seed(), createPostgresPool()

### Community 65 - "pms-api-client/package.json"
Cohesion: 0.17
Nodes (11): exports, files, main, name, private, publishConfig, access, type (+3 more)

### Community 66 - "tsconfig.spec.json"
Cohesion: 0.17
Nodes (11): compilerOptions, outDir, types, extends, include, node, src/**/*.spec.ts, ../../tsconfig.json (+3 more)

### Community 67 - "verify-seeds.mjs"
Cohesion: 0.50
Nodes (3): directory, failures, files

### Community 68 - "execute-calculation-step.ts"
Cohesion: 0.26
Nodes (4): PostgresCalculationStepRepository, CalculationStepRepository, CalculationStepRequest, ExecuteCalculationStep

### Community 69 - "InvestmentAccount"
Cohesion: 0.20
Nodes (4): assertDate(), InvestmentAccount, validate(), input

### Community 70 - "postgres-data-quality-dashboard.repository.ts"
Cohesion: 0.39
Nodes (4): PostgresDataQualityDashboardRepository, DataQualityDashboardFilter, DataQualityDashboardRepository, DataQualityDashboardRow

### Community 71 - ".action"
Cohesion: 0.26
Nodes (8): InvestmentAccountsController, Body, Controller, Get, Headers, Param, Post, Query

### Community 72 - "postgres-workflow-approval.repository.ts"
Cohesion: 0.36
Nodes (6): existingAction(), PostgresWorkflowApprovalRepository, transitionCalculation(), transitionClosing(), WorkflowApprovalCommand, WorkflowApprovalRepository

### Community 73 - "PurificationController"
Cohesion: 0.24
Nodes (8): PurificationController, Body, Controller, Get, Inject, Param, Post, Query

### Community 74 - "RevenueController"
Cohesion: 0.24
Nodes (7): RevenueController, Body, Controller, Get, Inject, Post, Query

### Community 75 - "verify-sdk-coverage.mjs"
Cohesion: 0.50
Nodes (3): contract, missing, operations

### Community 76 - "HealthController"
Cohesion: 0.17
Nodes (8): HealthController, Controller, Get, Public(), MetricsController, Controller, Get, Header

### Community 77 - "closing-workflow.ts"
Cohesion: 0.19
Nodes (15): PostgresClosingWorkflowRepository, AdvanceClosingCommand, AdvanceClosingWorkflow, ClosingWorkflowRepository, advanceClosingWorkflow(), assertQualityEvidence(), CLOSING_STEPS, ClosingQualityEvidence (+7 more)

### Community 78 - "engine/package.json"
Cohesion: 0.22
Nodes (8): dependencies, decimal.js, exports, decimal.js, name, private, type, version

### Community 79 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, @types/node, @types/pg, typescript, vitest, @types/node, @types/pg, typescript (+1 more)

### Community 80 - "createPmsApiClient"
Cohesion: 0.33
Nodes (7): createPmsApiClient(), commandRequest(), genericCommandRequest(), request(), workflowRequest(), PmsApiProblem, Problem

### Community 81 - ".approvePoolOperation"
Cohesion: 0.50
Nodes (3): Body, Param, Post

### Community 82 - "PMS observability stack"
Cohesion: 0.46
Nodes (8): Alertmanager, Grafana, Loki, PMS observability stack, OpenTelemetry Collector, Prometheus, Tempo, Grafana observability data sources

### Community 83 - "generate-sdk.mjs"
Cohesion: 0.32
Nodes (7): contract, contractUrl, objectType(), operations, outputUrl, schemas, typeFor()

### Community 84 - "project.json"
Cohesion: 0.25
Nodes (7): name, projectType, $schema, sourceRoot, tags, targets, type:sdk

### Community 85 - "manage-accounting-event.ts"
Cohesion: 0.19
Nodes (11): PostgresAccountingEventRepository, AccountingEventRepository, AcknowledgeAccountingEventCommand, EmitAccountingEventCommand, ACCOUNTING_EVENT_TYPES, AccountingAcknowledgementState, AccountingEventType, accountingSourceKey (+3 more)

### Community 86 - "reporting.module.ts"
Cohesion: 0.09
Nodes (26): AudienceDashboardController, Controller, Get, Inject, Param, Query, HistoricalForecastController, Controller (+18 more)

### Community 87 - "pooling.controller.ts"
Cohesion: 0.71
Nodes (4): MANAGE_ASSET_ALLOCATION, MANAGE_ASSET_QUALITY, MANAGE_INVESTMENT_POOL, MANAGE_POOL_COMPOSITION

### Community 89 - "verify-foundation.mjs"
Cohesion: 0.33
Nodes (5): controls, directory, filenames, migrations, missing

### Community 90 - "verify-runtime.mjs"
Cohesion: 0.29
Nodes (6): dashboard, dashboardMetrics, e2eClient, entrypoints, failures, localRealm

### Community 91 - "Runbook de déploiement Docker"
Cohesion: 0.33
Nodes (6): Docker Compose, Runbook de déploiement Docker, Promotion d'images immuables, Chaîne de confiance CI backend, Image OCI immuable, Signature Sigstore keyless

### Community 92 - "package.json"
Cohesion: 0.33
Nodes (5): name, packageManager, private, type, version

### Community 93 - "pms-api-client/tsconfig.json"
Cohesion: 0.33
Nodes (5): extends, files, include, ../../tsconfig.json, references

### Community 94 - "opentelemetry.ts"
Cohesion: 0.22
Nodes (7): AppModule, Module, shutdownTelemetry(), otlpSignalUrl(), startTelemetry(), stopTelemetry(), TelemetryOptions

### Community 95 - "planning-scenario.controller.ts"
Cohesion: 0.14
Nodes (16): PlanningScenarioController, Body, Controller, Headers, Inject, Param, Post, PostgresPlanningScenarioRepository (+8 more)

### Community 96 - "ADR-016 DDD comme langage commun"
Cohesion: 0.33
Nodes (6): Active Record rejeté, ADR-016 DDD comme langage commun, Domain-Driven Design, Revue Architecture V2 Active Record, Migrations en cinq phases, pms-backend

### Community 99 - "validate-contracts.mjs"
Cohesion: 0.50
Nodes (3): asyncApi, errors, openApi

### Community 100 - "OpenTelemetry Collector"
Cohesion: 0.50
Nodes (4): Loki, OpenTelemetry Collector, Prometheus, Tempo

### Community 120 - "reconcile-general-ledger.ts"
Cohesion: 0.20
Nodes (11): PostgresAccountingReconciliationRepository, ReconciliationCommand, ReconciliationRepository, discrepancyDeadline(), DiscrepancySeverity, DiscrepancyStatus, maximumResolutionHours, RECONCILIATION_TYPES (+3 more)

### Community 122 - "workflow-approval.module.ts"
Cohesion: 0.50
Nodes (3): Module, WorkflowApprovalModule, PERFORM_WORKFLOW_APPROVAL

### Community 123 - "certify-opening-balances.ts"
Cohesion: 0.20
Nodes (8): PostgresOpeningBalanceCertificationRepository, CertifyOpeningBalances, OpeningBalanceCertificationRepository, certifyOpeningBalances(), OpeningBalanceComponent, openingBalanceComponents, OpeningBalanceEvidence, lines

### Community 124 - "query-tenor-yield-curve.ts"
Cohesion: 0.11
Nodes (15): TenorCurveController, Controller, Get, Inject, Param, Query, PostgresTenorYieldCurveRepository, QueryTenorYieldCurve (+7 more)

### Community 125 - "risk-alm.module.ts"
Cohesion: 0.06
Nodes (39): RiskAlmController, Controller, Get, Inject, Param, CALCULATE_DCR, GET_PUBLISHED_RISK_DASHBOARD, RUN_STRESS_SCENARIO (+31 more)

### Community 127 - "balanced-journal.ts"
Cohesion: 0.22
Nodes (9): PostgresAccountingPostingRepository, AccountingPostingCommand, AccountingPostingRepository, ApprovedCalculationSnapshot, PostApprovedCalculation, allocationJournalLines(), assertBalancedJournal(), JournalLineDraft (+1 more)

### Community 129 - "execute-profit-calculation.ts"
Cohesion: 0.15
Nodes (17): bootstrap(), requiredEnvironment(), requiredQueue(), loadSnapshot(), PostgresCalculationExecutionRepository, CalculationExecutionRepository, CalculationRequest, CalculationSnapshot (+9 more)

### Community 130 - ".publish"
Cohesion: 0.33
Nodes (6): ReportingController, Body, Controller, Headers, Param, Post

### Community 131 - "evaluate-parallel-run.mjs"
Cohesion: 0.17
Nodes (10): approvedRoles, blockers, differences, keys, manualByKey, missingApprovals, pmsByKey, report (+2 more)

### Community 132 - "postgres-historical-yield-forecast.repository.ts"
Cohesion: 0.32
Nodes (4): PostgresHistoricalYieldForecastRepository, HistoricalForecastRepository, forecastPoolYield(), YieldObservation

### Community 133 - "ChargesController"
Cohesion: 0.22
Nodes (7): ChargesController, Body, Controller, Get, Inject, Post, Query

### Community 135 - "accounting.module.ts"
Cohesion: 0.25
Nodes (10): AccountingController, Controller, Inject, CERTIFY_OPENING_BALANCES, MANAGE_ACCOUNTING_EVENT, POST_APPROVED_CALCULATION, RECONCILE_GENERAL_LEDGER, REVERSE_POSTED_JOURNAL (+2 more)

### Community 136 - "batch-state.ts"
Cohesion: 0.50
Nodes (3): assertBatchTransition(), cbsBatchStates, transitions

### Community 137 - "PostgresInvestmentPositionValidationRepository"
Cohesion: 0.18
Nodes (5): PostgresInvestmentPositionValidationRepository, decimalEqual(), InvestmentPositionValidationRepository, InvestmentPositionValidationResult, ValidateInvestmentPositions

### Community 138 - "run-failover-drill.mjs"
Cohesion: 0.20
Nodes (7): evidence, exercise(), request(), results, rpoTargetMs, rtoTargetMs, services

### Community 140 - "RequireAuthorization"
Cohesion: 0.11
Nodes (24): Body, Headers, Param, Post, Get, Headers, Query, AuthenticatedUser (+16 more)

### Community 141 - "TokenizationController"
Cohesion: 0.48
Nodes (6): context(), TokenizationController, Body, Controller, Headers, Post

### Community 145 - "queue-depth-scaler.mjs"
Cohesion: 0.25
Nodes (7): composeScale(), cooldown, interval, max, min, perReplica, tick()

### Community 146 - ".get"
Cohesion: 0.50
Nodes (3): Get, Param, Query

### Community 148 - "closing-governance.ts"
Cohesion: 0.47
Nodes (4): AcceptedClosingRisk, buildClosingEvidenceManifest(), ClosingEvidenceInput, ClosingEvidenceManifest

### Community 149 - "Q: Implémenter la certification des soldes d'ouverture migrés et bloquer le premier run réel"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implémenter la certification des soldes d'ouverture migrés et bloquer le premier run réel, Source Nodes

### Community 150 - "evaluate-pentest.mjs"
Cohesion: 0.40
Nodes (3): findings, openCritical, summary

### Community 158 - "CustomersController"
Cohesion: 0.36
Nodes (6): CustomersController, Body, Controller, Get, Param, Post

### Community 159 - ".generate"
Cohesion: 0.40
Nodes (6): SecureExportController, Body, Controller, Headers, Param, Post

### Community 160 - "WorkflowApprovalController"
Cohesion: 0.41
Nodes (7): Body, Controller, Headers, Param, Post, WorkflowApprovalController, WorkflowAction

### Community 162 - "ComplianceController"
Cohesion: 0.44
Nodes (5): ComplianceController, Body, Controller, Param, Post

### Community 168 - "ComplianceReference"
Cohesion: 0.33
Nodes (3): ComplianceReference, date(), isUuid()

## Knowledge Gaps
- **415 isolated node(s):** `PoolOperationBody`, `groupRoleMapping`, `HttpRequest`, `LATENCY_BUCKETS`, `MetricSeries` (+410 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RequireAuthorization()` connect `RequireAuthorization` to `PoolingController`, `.publish`, `ChargesController`, `accounting.module.ts`, `revenue.module.ts`, `TokenizationController`, `ProductsController`, `cbs-ingestion.module.ts`, `.get`, `audit.module.ts`, `purification.ts`, `recognized-income.ts`, `CustomersController`, `.generate`, `WorkflowApprovalController`, `ComplianceController`, `app.module.ts`, `calculations.module.ts`, `investment-accounts.module.ts`, `products.module.ts`, `documents.module.ts`, `.action`, `PurificationController`, `RevenueController`, `.approvePoolOperation`, `reporting.module.ts`, `pooling.controller.ts`, `planning-scenario.controller.ts`, `query-tenor-yield-curve.ts`, `risk-alm.module.ts`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `createPostgresPool()` connect `postgres-client.ts` to `execute-profit-calculation.ts`, `document-worker/src/main.ts`, `PostgresDatabaseService`, `closing-worker/src/main.ts`, `ingestion-worker/src/main.ts`, `scheduler/src/main.ts`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `AuthenticatedUserClaims` connect `RequireAuthorization` to `PoolingController`, `.publish`, `accounting.module.ts`, `revenue.module.ts`, `TokenizationController`, `ProductsController`, `audit.module.ts`, `CustomersController`, `.generate`, `WorkflowApprovalController`, `ComplianceController`, `investment-accounts.module.ts`, `products.module.ts`, `authorization.guard.ts`, `documents.module.ts`, `.action`, `reporting.module.ts`, `pooling.controller.ts`, `planning-scenario.controller.ts`, `risk-alm.module.ts`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **What connects `PoolOperationBody`, `groupRoleMapping`, `HttpRequest` to the rest of the system?**
  _415 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PersonalDataClass` be split into smaller, more focused modules?**
  _Cohesion score 0.06881287726358148 - nodes in this community are weakly interconnected._
- **Should `reference-data.module.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06187202538339503 - nodes in this community are weakly interconnected._
- **Should `compliance.module.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12962962962962962 - nodes in this community are weakly interconnected._