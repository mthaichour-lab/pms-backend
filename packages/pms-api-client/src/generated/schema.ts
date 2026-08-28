// Generated from contracts/openapi/pms-api.v1.json. Do not edit.
export const apiVersion = "1.0.0" as const;

export const operationIds = [
  "getApiStatus",
  "getEffectiveCurrency",
  "getInvestmentAccountSnapshot",
  "approvePoolOperation"
] as const;

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

export type Problem = {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly correlationId?: string;
};
