# Graph Report - pms-backend  (2026-09-09)

## Corpus Check
- 505 files · ~94,154 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2708 nodes · 5675 edges · 158 communities (128 shown, 30 thin omitted)
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
- balanced-journal.ts
- workflow-approval.controller.ts
- ProductTermsState
- customer-profile.ts
- exceptions.controller.ts
- schema.ts
- client.ts
- charge-policy.ts
- InvestmentProductState
- manage-product-references.ts
- ProductsController
- AssetAllocation
- cbs-ingestion.module.ts
- closing-worker/src/main.ts
- manage-regulatory-report.ts
- InvestmentProduct
- register-cbs-batch.ts
- cbs-batch-message-handler.ts
- scheduler/src/main.ts
- audit.module.ts
- pooling.controller.ts
- purification.ts
- pool-composition-snapshot.ts
- recognized-income.ts
- investment-pool.ts
- musharaka-allocation.ts
- SqlClient
- authenticate-cbs-manifest.ts
- compilerOptions
- scripts
- ManageInvestmentPool
- dependencies
- InvestmentSubscription
- document-worker/src/main.ts
- app.module.ts
- HttpMetricsRegistry
- paperless-http.adapter.ts
- moudaraba-allocation.ts
- PostgresDatabaseService
- compilerOptions
- real-dependencies.mjs
- rabbitmq-event-consumer.adapter.ts
- calculations.module.ts
- .transition
- compilerOptions
- manual-findings.schema.json
- ingestion-worker/src/main.ts
- investment-accounts.module.ts
- correlation.middleware.ts
- InvestmentSubscriptionState
- investment-subscription.ts
- AppModule
- intergenerational-equity.ts
- products.module.ts
- stage-investment-positions.ts
- postgres-investment-account-query.repository.ts
- revenue.module.ts
- authorization.decorator.ts
- manage-secure-export.ts
- documents.controller.ts
- pms-api-client/package.json
- tsconfig.spec.json
- verify-seeds.mjs
- execute-calculation-step.ts
- InvestmentAccount
- .action
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
- query-audience-dashboard.ts
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
- .transition
- certify-opening-balances.ts
- query-tenor-yield-curve.ts
- risk-alm.module.ts
- @opentelemetry/exporter-trace-otlp-proto
- post-approved-calculation.ts
- @opentelemetry/semantic-conventions
- execute-profit-calculation.ts
- AuthenticatedUserClaims
- evaluate-parallel-run.mjs
- postgres-historical-yield-forecast.repository.ts
- ChargesController
- reflect-metadata
- accounting.module.ts
- validate-investment-positions.ts
- run-failover-drill.mjs
- RequireAuthorization
- AuthenticatedUser
- PurificationCase
- queue-depth-scaler.mjs
- ProfitExplanationController
- TenorCurveController
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
- .get
- ComplianceReference

## God Nodes (most connected - your core abstractions)
1. `RequireAuthorization()` - 93 edges
2. `AuthenticatedUserClaims` - 70 edges
3. `AuthenticatedUser` - 64 edges
4. `scripts` - 32 edges
5. `bootstrap()` - 27 edges
6. `SqlClient` - 27 edges
7. `PersonalDataClass` - 22 edges
8. `PostgresDatabaseService` - 21 edges
9. `OutboxMessage` - 21 edges
10. `InvestmentSubscription` - 21 edges

## Surprising Connections (you probably didn't know these)
- `AuthenticatedUserClaims` --references--> `PmsRole`  [EXTRACTED]
  apps/api/src/auth/authenticated-user.ts → src/shared-kernel/authorization-contracts.ts
- `bootstrap()` --calls--> `createPostgresPool()`  [EXTRACTED]
  apps/calculation-worker/src/main.ts → src/infrastructure/persistence/postgres-client.ts
- `bootstrap()` --calls--> `PostgresInboxRepository`  [EXTRACTED]
  apps/calculation-worker/src/main.ts → src/infrastructure/persistence/postgres-inbox.repository.ts
- `ClosingMessageHandler` --references--> `IdempotentConsumer`  [EXTRACTED]
  apps/closing-worker/src/closing-message-handler.ts → src/infrastructure/messaging/idempotent-consumer.ts
- `bootstrap()` --calls--> `createPostgresPool()`  [EXTRACTED]
  apps/closing-worker/src/main.ts → src/infrastructure/persistence/postgres-client.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Routage des signaux d'observabilité** — deploy_observability_otel_collector_opentelemetry_collector, deploy_observability_tempo_tempo, deploy_observability_prometheus_prometheus, deploy_observability_loki_loki [EXTRACTED 1.00]

## Communities (158 total, 30 thin omitted)

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

### Community 4 - "balanced-journal.ts"
Cohesion: 0.23
Nodes (9): PostgresAccountingReversalRepository, AccountingReversalRepository, JournalReversalCommand, PostedJournalSnapshot, ReversePostedJournal, allocationJournalLines(), assertBalancedJournal(), JournalLineDraft (+1 more)

### Community 5 - "workflow-approval.controller.ts"
Cohesion: 0.13
Nodes (14): ApprovalBody, Inject, Module, WorkflowApprovalModule, PERFORM_WORKFLOW_APPROVAL, existingAction(), PostgresWorkflowApprovalRepository, transitionCalculation() (+6 more)

### Community 6 - "ProductTermsState"
Cohesion: 0.09
Nodes (21): assertRetroactiveApproval(), insertCommand(), lockAndFindCommand(), mapTerms(), PostgresProductTermsRepository, TermsRow, commandFor(), ManageProductTerms (+13 more)

### Community 7 - "customer-profile.ts"
Cohesion: 0.08
Nodes (21): Inject, CustomersModule, Module, MANAGE_CUSTOMER_PROFILE, PostgresCustomerProfileRepository, CustomerProfileRepository, ManageCustomerProfile, assertDate() (+13 more)

### Community 8 - "exceptions.controller.ts"
Cohesion: 0.14
Nodes (14): Inject, ExceptionsModule, Module, MANAGE_EXCEPTION_CASE, PostgresExceptionCaseRepository, CreateExceptionCommand, ExceptionCaseRepository, ManageExceptionCase (+6 more)

### Community 9 - "schema.ts"
Cohesion: 0.04
Nodes (54): AccountingAcknowledgementResult, AccountingJournalLine, ApiStatus, apiVersion, ApprovedPoolOperation, ApprovePoolOperationCommand, AssetAllocation, AssetAnomaly (+46 more)

### Community 10 - "client.ts"
Cohesion: 0.04
Nodes (53): CommandInput, OpeningBalanceCertificationCommand, PmsApiClientOptions, QuotationCommand, AccountingAcknowledgementCommand, AccountingEventCommand, AccountingEventResult, AccountingPostingResult (+45 more)

### Community 11 - "charge-policy.ts"
Cohesion: 0.13
Nodes (15): PostgresChargeMatrixRepository, ChargeMatrixRepository, ManageChargeMatrix, ChargeEvaluation, ChargePolicy, ChargeResponsibility, date(), evaluatePoolCharges() (+7 more)

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
Cohesion: 0.13
Nodes (14): CbsIngestionController, optionalInteger(), Controller, Get, Inject, Query, CbsIngestionModule, Module (+6 more)

### Community 17 - "closing-worker/src/main.ts"
Cohesion: 0.10
Nodes (20): calculationWorker, ClosingMessageHandler, stringField(), bootstrap(), requiredEnvironment(), requiredQueue(), closingWorker, documentWorker (+12 more)

### Community 18 - "manage-regulatory-report.ts"
Cohesion: 0.17
Nodes (10): Inject, canonicalJson(), PostgresRegulatoryReportRepository, sha256(), ManageRegulatoryReport, RegulatoryReportRepository, uuid(), assertPublishableReport() (+2 more)

### Community 19 - "InvestmentProduct"
Cohesion: 0.17
Nodes (5): InvestmentProduct, InvestmentProductStatus, isUuid(), toMillionths(), validateState()

### Community 20 - "register-cbs-batch.ts"
Cohesion: 0.12
Nodes (14): PostgresCbsBatchRepository, SignedCbsManifest, CbsBatchDescriptor, CbsBatchRepository, RegisterCbsBatch, validate(), CbsLandingStoragePort, ScanCbsBatch (+6 more)

### Community 21 - "cbs-batch-message-handler.ts"
Cohesion: 0.16
Nodes (12): CalculationMessageHandler, optionalRunKind(), stringField(), CbsBatchMessageHandler, integerField(), stringField(), IdempotentConsumer, InboxRepository (+4 more)

### Community 22 - "scheduler/src/main.ts"
Cohesion: 0.07
Nodes (19): ClosingGovernanceScheduler, bootstrap(), positiveIntegerEnvironment(), requiredEnvironment(), OutboxScheduler, EventPublisher, OutboxRepository, OutboxRelay (+11 more)

### Community 23 - "audit.module.ts"
Cohesion: 0.07
Nodes (26): AuditController, Controller, Get, Inject, Query, QUERY_AUDIT_TRAIL, KmsHttpAuditSigner, KmsHttpAuditSignerOptions (+18 more)

### Community 24 - "pooling.controller.ts"
Cohesion: 0.14
Nodes (11): MANAGE_ASSET_ALLOCATION, MANAGE_ASSET_QUALITY, MANAGE_INVESTMENT_POOL, MANAGE_POOL_COMPOSITION, PostgresAssetQualityRepository, AssetQualityRepository, ManageAssetQuality, AssetAnomaly (+3 more)

### Community 25 - "purification.ts"
Cohesion: 0.12
Nodes (13): mapCase(), PostgresPurificationRepository, ManagePurification, PurificationRepository, date(), decimal(), format(), PurificationCase (+5 more)

### Community 26 - "pool-composition-snapshot.ts"
Cohesion: 0.16
Nodes (11): PostgresPoolCompositionRepository, ManagePoolComposition, PoolCompositionRepository, composePoolSnapshot(), CompositionBucket, date(), decimal(), format() (+3 more)

### Community 27 - "recognized-income.ts"
Cohesion: 0.17
Nodes (11): PostgresRecognizedIncomeRepository, RecognizedIncomeRepository, date(), decimal(), IncomeAdjustment, IncomeCashStatus, IncomeRealizationStatus, RecognizedIncome (+3 more)

### Community 28 - "investment-pool.ts"
Cohesion: 0.13
Nodes (10): copySource(), date(), FundingSourceType, InvestmentPool, money(), percent(), PoolStatus, validate() (+2 more)

### Community 29 - "musharaka-allocation.ts"
Cohesion: 0.06
Nodes (49): BANK_LIABILITY_CAUSES, classifyLossAbsorption(), decimal(), IrrAbsorptionPolicy, isBankLiabilityCause(), LossAbsorptionInput, LossAbsorptionResult, LossCause (+41 more)

### Community 30 - "SqlClient"
Cohesion: 0.10
Nodes (13): migrate(), requiredEnvironment(), requiredEnvironment(), seed(), RunStatus, createPostgresPool(), SqlClient, PostgresDocumentReferenceRepository (+5 more)

### Community 31 - "authenticate-cbs-manifest.ts"
Cohesion: 0.17
Nodes (10): Ed25519CbsSignatureVerifier, AuthenticateCbsManifest, canonicalBytes(), canonicalCbsManifest(), CbsAuthenticationRepository, CbsSignatureVerifier, insideWindow(), validate() (+2 more)

### Community 32 - "compilerOptions"
Cohesion: 0.10
Nodes (20): tests/**/*.ts, compilerOptions, emitDecoratorMetadata, experimentalDecorators, forceConsistentCasingInFileNames, module, moduleResolution, noEmit (+12 more)

### Community 33 - "scripts"
Cohesion: 0.06
Nodes (32): scripts, build, contracts:check-sdk, contracts:generate-sdk, contracts:lint, database:verify, database:verify-seeds, deploy:verify (+24 more)

### Community 34 - "ManageInvestmentPool"
Cohesion: 0.16
Nodes (7): Inject, PostgresInvestmentPoolRepository, InvestmentPoolRepository, ManageInvestmentPool, FundingSource, InvestmentPoolState, state

### Community 35 - "dependencies"
Cohesion: 0.07
Nodes (27): amqplib, @nestjs/core, @nestjs/platform-express, @opentelemetry/auto-instrumentations-node, @opentelemetry/exporter-logs-otlp-proto, @opentelemetry/exporter-metrics-otlp-proto, @opentelemetry/resources, @opentelemetry/sdk-logs (+19 more)

### Community 36 - "InvestmentSubscription"
Cohesion: 0.25
Nodes (3): assertDate(), InvestmentSubscription, positive()

### Community 37 - "document-worker/src/main.ts"
Cohesion: 0.09
Nodes (30): archivePayload(), DocumentMessageHandler, LandingStoragePort, bootstrap(), positiveIntegerEnvironment(), requiredEnvironment(), ClamAvAntivirusAdapter, ClamAvOptions (+22 more)

### Community 38 - "app.module.ts"
Cohesion: 0.07
Nodes (30): AccountingModule, Module, AppController, PoolOperationBody, Controller, Get, AppService, Injectable (+22 more)

### Community 39 - "HttpMetricsRegistry"
Cohesion: 0.16
Nodes (11): Public(), escapeLabel(), HttpMetricsRegistry, LATENCY_BUCKETS, MetricSeries, normalizeMetricPath(), Injectable, MetricsController (+3 more)

### Community 40 - "paperless-http.adapter.ts"
Cohesion: 0.29
Nodes (7): firstTask(), normalizedBaseUrl(), PaperlessHttpAdapter, PaperlessHttpOptions, safeTaskMessage(), taskIdentifier(), toArrayBuffer()

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
Nodes (31): CalculationsController, Controller, Get, Inject, Param, GET_CALCULATION_RUN, SOLVE_QUOTATION, SimulationsController (+23 more)

### Community 47 - ".transition"
Cohesion: 0.36
Nodes (6): ExceptionsController, Body, Controller, Headers, Param, Post

### Community 48 - "compilerOptions"
Cohesion: 0.13
Nodes (14): **/*.spec.ts, compilerOptions, declaration, noEmit, outDir, rootDir, sourceMap, exclude (+6 more)

### Community 49 - "manual-findings.schema.json"
Cohesion: 0.05
Nodes (40): ACCEPTED_WITH_APPROVAL, CLOSED, CRITICAL, engagementReference, environment, findings, HIGH, id (+32 more)

### Community 50 - "ingestion-worker/src/main.ts"
Cohesion: 0.09
Nodes (16): bootstrap(), nonNegativeIntegerEnvironment(), positiveIntegerEnvironment(), requiredEnvironment(), requiredQueue(), sourcePublicKeys(), decodeFilename(), HttpLandingStorageAdapter (+8 more)

### Community 51 - "investment-accounts.module.ts"
Cohesion: 0.30
Nodes (6): Inject, GET_INVESTMENT_ACCOUNT_SNAPSHOT, MANAGE_INVESTMENT_SUBSCRIPTION, GetInvestmentAccountSnapshot, ManageInvestmentSubscription, SubscriptionAction

### Community 52 - "correlation.middleware.ts"
Cohesion: 0.31
Nodes (6): correlationFromHeader(), CorrelationMiddleware, HttpRequest, isTraceparent(), singleHeader(), Injectable

### Community 53 - "InvestmentSubscriptionState"
Cohesion: 0.23
Nodes (5): PostgresInvestmentSubscriptionRepository, CustomerProfitRightsPolicy, InvestmentSubscriptionRepository, InvestmentSubscriptionState, SubscriptionEvent

### Community 54 - "investment-subscription.ts"
Cohesion: 0.22
Nodes (5): SubscriptionEventType, SubscriptionStatus, TermsAcceptance, validate(), input

### Community 56 - "intergenerational-equity.ts"
Cohesion: 0.31
Nodes (12): analyzeIntergenerationalEquity(), assertScale(), ExactDecimal, formatted(), GenerationEquityView, IntergenerationalEquityResult, InvestorGenerationResult, nonNegative() (+4 more)

### Community 57 - "products.module.ts"
Cohesion: 0.28
Nodes (6): Inject, MANAGE_INVESTMENT_PRODUCT, MANAGE_PRODUCT_REFERENCES, MANAGE_PRODUCT_TERMS, ManageInvestmentProduct, ManageProductReferences

### Community 58 - "stage-investment-positions.ts"
Cohesion: 0.26
Nodes (6): normalizeDecimal(), InvestmentPositionRow, InvestmentPositionStagingRepository, parseCsv(), parseInvestmentPositionsCsv(), StageInvestmentPositions

### Community 59 - "postgres-investment-account-query.repository.ts"
Cohesion: 0.27
Nodes (6): PostgresInvestmentAccountQueryRepository, SnapshotRow, InvestmentAccountQueryRepository, InvestmentAccountSnapshot, InvestmentAccountState, InvestmentAccountStatus

### Community 60 - "revenue.module.ts"
Cohesion: 0.29
Nodes (5): MANAGE_CHARGE_MATRIX, MANAGE_PURIFICATION, MANAGE_RECOGNIZED_INCOME, ManageRecognizedIncome, income

### Community 61 - "authorization.decorator.ts"
Cohesion: 0.07
Nodes (36): AuthenticatedRequest, OidcJwtGuard, Injectable, PUBLIC_ROUTE, AUTHORIZATION_POLICY, asOptionalString(), AuthorizationGuard, AuthorizationHttpRequest (+28 more)

### Community 62 - "manage-secure-export.ts"
Cohesion: 0.14
Nodes (16): Inject, PostgresSecureExportRepository, CreateSecureExportCommand, ManageSecureExport, SecureExportRepository, validateAction(), approveMassExport(), assertExportDatasetSafe() (+8 more)

### Community 63 - "documents.controller.ts"
Cohesion: 0.11
Nodes (19): DocumentsController, Body, Controller, Get, Headers, Inject, Param, Post (+11 more)

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

### Community 71 - ".action"
Cohesion: 0.26
Nodes (8): InvestmentAccountsController, Body, Controller, Get, Headers, Param, Post, Query

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
Cohesion: 0.36
Nodes (3): HealthController, Controller, Get

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
Cohesion: 0.17
Nodes (12): PostgresAccountingEventRepository, AccountingEventRepository, AcknowledgeAccountingEventCommand, EmitAccountingEventCommand, ManageAccountingEvent, ACCOUNTING_EVENT_TYPES, AccountingAcknowledgementState, AccountingEventType (+4 more)

### Community 86 - "reporting.module.ts"
Cohesion: 0.15
Nodes (14): HistoricalForecastController, Controller, Inject, GENERATE_HISTORICAL_YIELD_FORECAST, MANAGE_PLANNING_SCENARIO, MANAGE_REGULATORY_REPORT, MANAGE_SECURE_EXPORT, QUERY_AUDIENCE_DASHBOARD (+6 more)

### Community 87 - "query-audience-dashboard.ts"
Cohesion: 0.26
Nodes (7): PostgresAudienceDashboardRepository, AudienceDashboardRepository, QueryAudienceDashboard, assertDashboardCompliance(), DASHBOARD_ITEMS, DashboardAudience, DashboardItem

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
Cohesion: 0.43
Nodes (5): shutdownTelemetry(), otlpSignalUrl(), startTelemetry(), stopTelemetry(), TelemetryOptions

### Community 95 - "planning-scenario.controller.ts"
Cohesion: 0.23
Nodes (9): PostgresPlanningScenarioRepository, CreatePlanningScenarioCommand, ManagePlanningScenario, PlanningScenarioRepository, PlanningAssumptions, PlanningScenarioKind, PlanningScenarioStatus, projectTwelveMonths() (+1 more)

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

### Community 122 - ".transition"
Cohesion: 0.27
Nodes (7): PlanningScenarioController, Body, Controller, Headers, Inject, Param, Post

### Community 123 - "certify-opening-balances.ts"
Cohesion: 0.20
Nodes (8): PostgresOpeningBalanceCertificationRepository, CertifyOpeningBalances, OpeningBalanceCertificationRepository, certifyOpeningBalances(), OpeningBalanceComponent, openingBalanceComponents, OpeningBalanceEvidence, lines

### Community 124 - "query-tenor-yield-curve.ts"
Cohesion: 0.19
Nodes (9): PostgresTenorYieldCurveRepository, QueryTenorYieldCurve, TenorCurveRepository, TenorCurveSource, buckets, buildTenorYieldCurve(), TenorCurvePoint, TenorGap (+1 more)

### Community 125 - "risk-alm.module.ts"
Cohesion: 0.06
Nodes (39): RiskAlmController, Controller, Get, Inject, Param, CALCULATE_DCR, GET_PUBLISHED_RISK_DASHBOARD, RUN_STRESS_SCENARIO (+31 more)

### Community 127 - "post-approved-calculation.ts"
Cohesion: 0.21
Nodes (6): Inject, PostgresAccountingPostingRepository, AccountingPostingCommand, AccountingPostingRepository, ApprovedCalculationSnapshot, PostApprovedCalculation

### Community 129 - "execute-profit-calculation.ts"
Cohesion: 0.07
Nodes (30): bootstrap(), requiredEnvironment(), requiredQueue(), loadSnapshot(), PostgresCalculationExecutionRepository, CalculationExecutionRepository, CalculationRequest, CalculationSnapshot (+22 more)

### Community 130 - "AuthenticatedUserClaims"
Cohesion: 0.15
Nodes (12): AuthenticatedUserClaims, Headers, Param, Post, ReportingController, Body, Controller, Headers (+4 more)

### Community 131 - "evaluate-parallel-run.mjs"
Cohesion: 0.17
Nodes (10): approvedRoles, blockers, differences, keys, manualByKey, missingApprovals, pmsByKey, report (+2 more)

### Community 132 - "postgres-historical-yield-forecast.repository.ts"
Cohesion: 0.32
Nodes (4): PostgresHistoricalYieldForecastRepository, HistoricalForecastRepository, forecastPoolYield(), YieldObservation

### Community 133 - "ChargesController"
Cohesion: 0.24
Nodes (7): ChargesController, Body, Controller, Get, Inject, Post, Query

### Community 135 - "accounting.module.ts"
Cohesion: 0.42
Nodes (6): CERTIFY_OPENING_BALANCES, MANAGE_ACCOUNTING_EVENT, POST_APPROVED_CALCULATION, RECONCILE_GENERAL_LEDGER, REVERSE_POSTED_JOURNAL, ReconcileGeneralLedger

### Community 137 - "validate-investment-positions.ts"
Cohesion: 0.24
Nodes (4): decimalEqual(), InvestmentPositionValidationRepository, InvestmentPositionValidationResult, ValidateInvestmentPositions

### Community 138 - "run-failover-drill.mjs"
Cohesion: 0.20
Nodes (7): evidence, exercise(), request(), results, rpoTargetMs, rtoTargetMs, services

### Community 140 - "RequireAuthorization"
Cohesion: 0.41
Nodes (7): AccountingController, Body, Controller, Headers, Param, Post, RequireAuthorization()

### Community 141 - "AuthenticatedUser"
Cohesion: 0.47
Nodes (7): AuthenticatedUser, context(), TokenizationController, Body, Controller, Headers, Post

### Community 145 - "queue-depth-scaler.mjs"
Cohesion: 0.25
Nodes (7): composeScale(), cooldown, interval, max, min, perReplica, tick()

### Community 146 - "ProfitExplanationController"
Cohesion: 0.25
Nodes (6): ProfitExplanationController, Controller, Get, Inject, Param, Query

### Community 147 - "TenorCurveController"
Cohesion: 0.25
Nodes (6): TenorCurveController, Controller, Get, Inject, Param, Query

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
Cohesion: 0.47
Nodes (6): Body, Controller, Headers, Param, Post, WorkflowApprovalController

### Community 162 - "ComplianceController"
Cohesion: 0.44
Nodes (5): ComplianceController, Body, Controller, Param, Post

### Community 166 - ".get"
Cohesion: 0.25
Nodes (6): AudienceDashboardController, Controller, Get, Inject, Param, Query

### Community 168 - "ComplianceReference"
Cohesion: 0.33
Nodes (3): ComplianceReference, date(), isUuid()

## Knowledge Gaps
- **415 isolated node(s):** `PoolOperationBody`, `groupRoleMapping`, `HttpRequest`, `LATENCY_BUCKETS`, `MetricSeries` (+410 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RequireAuthorization()` connect `RequireAuthorization` to `PoolingController`, `PersonalDataClass`, `AuthenticatedUserClaims`, `compliance.module.ts`, `ChargesController`, `workflow-approval.controller.ts`, `accounting.module.ts`, `customer-profile.ts`, `exceptions.controller.ts`, `charge-policy.ts`, `AuthenticatedUser`, `ProductsController`, `cbs-ingestion.module.ts`, `ProfitExplanationController`, `TenorCurveController`, `audit.module.ts`, `pooling.controller.ts`, `CustomersController`, `.generate`, `WorkflowApprovalController`, `ComplianceController`, `app.module.ts`, `.get`, `calculations.module.ts`, `.transition`, `investment-accounts.module.ts`, `products.module.ts`, `revenue.module.ts`, `authorization.decorator.ts`, `manage-secure-export.ts`, `documents.controller.ts`, `.action`, `PurificationController`, `RevenueController`, `.approvePoolOperation`, `reporting.module.ts`, `planning-scenario.controller.ts`, `.transition`, `risk-alm.module.ts`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Why does `PostgresDatabaseService` connect `PostgresDatabaseService` to `reference-data.module.ts`, `compliance.module.ts`, `workflow-approval.controller.ts`, `accounting.module.ts`, `customer-profile.ts`, `exceptions.controller.ts`, `calculations.module.ts`, `cbs-ingestion.module.ts`, `investment-accounts.module.ts`, `reporting.module.ts`, `audit.module.ts`, `pooling.controller.ts`, `products.module.ts`, `revenue.module.ts`, `risk-alm.module.ts`, `documents.controller.ts`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `createPostgresPool()` connect `SqlClient` to `execute-profit-calculation.ts`, `document-worker/src/main.ts`, `PostgresDatabaseService`, `closing-worker/src/main.ts`, `ingestion-worker/src/main.ts`, `scheduler/src/main.ts`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `PoolOperationBody`, `groupRoleMapping`, `HttpRequest` to the rest of the system?**
  _415 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PersonalDataClass` be split into smaller, more focused modules?**
  _Cohesion score 0.06964006259780908 - nodes in this community are weakly interconnected._
- **Should `reference-data.module.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06041986687147977 - nodes in this community are weakly interconnected._
- **Should `compliance.module.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1330049261083744 - nodes in this community are weakly interconnected._