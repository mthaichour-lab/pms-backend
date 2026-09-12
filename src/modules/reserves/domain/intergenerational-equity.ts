import { Decimal } from 'decimal.js';

const ExactDecimal = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_EVEN });

export interface InvestorGenerationResult {
  generationId: string;
  participationBase: string;
  realizedProfit: string;
  distributedProfit: string;
}

export interface GenerationEquityView extends InvestorGenerationResult {
  realizedProfitRate: string;
  distributedProfitRate: string;
  distributionGapRate: string;
}

export interface IntergenerationalEquityResult {
  generations: readonly GenerationEquityView[];
  minimumDistributedRate: string;
  maximumDistributedRate: string;
  intergenerationalSpread: string;
  imbalanceDetected: boolean;
}

export interface ReserveSimulationInput {
  reserveType: 'PER' | 'IRR';
  investorBalance: string;
  bankBalance: string;
  investorMovement: string;
  bankMovement: string;
  outputScale?: number;
}

export function analyzeIntergenerationalEquity(
  generations: readonly InvestorGenerationResult[],
  toleratedSpread: string,
  outputScale = 12,
): IntergenerationalEquityResult {
  if (generations.length < 2) throw new TypeError('At least two investor generations are required');
  assertScale(outputScale);
  const tolerance = nonNegative(toleratedSpread, 'toleratedSpread');
  const seen = new Set<string>();
  const views = generations.map((generation) => {
    if (!generation.generationId || seen.has(generation.generationId)) throw new TypeError(`Duplicate or empty generationId: ${generation.generationId}`);
    seen.add(generation.generationId);
    const base = positive(generation.participationBase, `participationBase:${generation.generationId}`);
    const realized = signed(generation.realizedProfit, `realizedProfit:${generation.generationId}`);
    const distributed = signed(generation.distributedProfit, `distributedProfit:${generation.generationId}`);
    const realizedRate = realized.dividedBy(base);
    const distributedRate = distributed.dividedBy(base);
    return {
      ...generation,
      realizedProfitRate: formatted(realizedRate, outputScale),
      distributedProfitRate: formatted(distributedRate, outputScale),
      distributionGapRate: formatted(distributedRate.minus(realizedRate), outputScale),
      distributedRate,
    };
  });
  const minimum = Decimal.min(...views.map((view) => view.distributedRate));
  const maximum = Decimal.max(...views.map((view) => view.distributedRate));
  const spread = maximum.minus(minimum);
  return {
    generations: views.map(({ distributedRate: _internal, ...view }) => view),
    minimumDistributedRate: formatted(minimum, outputScale),
    maximumDistributedRate: formatted(maximum, outputScale),
    intergenerationalSpread: formatted(spread, outputScale),
    imbalanceDetected: spread.greaterThan(tolerance),
  };
}

export function simulateReserveMovement(input: ReserveSimulationInput) {
  const scale = input.outputScale ?? 12;
  assertScale(scale);
  const investorBefore = nonNegative(input.investorBalance, 'investorBalance');
  const bankBefore = nonNegative(input.bankBalance, 'bankBalance');
  const investorAfter = investorBefore.plus(signed(input.investorMovement, 'investorMovement'));
  const bankAfter = bankBefore.plus(signed(input.bankMovement, 'bankMovement'));
  if (investorAfter.isNegative() || bankAfter.isNegative()) throw new RangeError('Simulated reserve ownership cannot become negative');
  return {
    simulation: true as const,
    reserveType: input.reserveType,
    before: { investorBalance: formatted(investorBefore, scale), bankBalance: formatted(bankBefore, scale) },
    after: { investorBalance: formatted(investorAfter, scale), bankBalance: formatted(bankAfter, scale) },
    totalMovement: formatted(investorAfter.plus(bankAfter).minus(investorBefore).minus(bankBefore), scale),
  };
}

function assertScale(scale: number): void {
  if (!Number.isInteger(scale) || scale < 0 || scale > 24) throw new RangeError('outputScale must be an integer between 0 and 24');
}
function nonNegative(value: string, field: string): Decimal {
  const parsed = signed(value, field);
  if (parsed.isNegative()) throw new RangeError(`${field} cannot be negative`);
  return parsed;
}
function positive(value: string, field: string): Decimal {
  const parsed = nonNegative(value, field);
  if (parsed.isZero()) throw new RangeError(`${field} must be positive`);
  return parsed;
}
function signed(value: string, field: string): Decimal {
  if (!/^-?(0|[1-9]\d*)(?:\.\d+)?$/.test(value)) throw new TypeError(`${field} must be a canonical decimal string`);
  return new ExactDecimal(value);
}
function formatted(value: Decimal, scale: number): string {
  return value.toDecimalPlaces(scale, Decimal.ROUND_HALF_EVEN).toFixed(scale);
}
