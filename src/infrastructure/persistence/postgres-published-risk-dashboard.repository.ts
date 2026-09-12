import type { Pool } from 'pg';
import type { PublishedRiskDashboard, PublishedRiskDashboardRepository } from '../../modules/risk-alm/application/get-published-risk-dashboard.js';

export class PostgresPublishedRiskDashboardRepository implements PublishedRiskDashboardRepository {
  constructor(private readonly pool: Pick<Pool, 'query'>) {}

  async findLatestPublished(poolId: string): Promise<PublishedRiskDashboard | undefined> {
    const result = await this.pool.query<{
      run_id:string;pool_id:string;business_date:string;currency_code:string;pool_profit_rate:string;distributed_profit_rate:string;yield_gap:string;
      bank_margin:string;total_resources:string;invested_amount:string;average_duration_days:string|null;asset_concentration_rate:string;
      maturity_gaps:unknown;currency_gaps:unknown;per_coverage_rate:string;irr_coverage_rate:string;dcr_value:string|null;dcr_state:'WITHIN_LIMIT'|'BREACH'|null;
    }>(`WITH latest_run AS(
      SELECT r.* FROM calculation.run r WHERE r.pool_id=$1 AND r.status IN('POSTED','ARCHIVED') ORDER BY r.business_date DESC,r.revision DESC LIMIT 1
    ), composition AS(
      SELECT c.* FROM pooling.composition_snapshot c JOIN latest_run r ON r.run_id=c.run_id WHERE c.certified
    ), income AS(
      SELECT COALESCE(sum(i.amount),0) amount FROM revenue.recognized_income i JOIN latest_run r ON r.pool_id=i.pool_id AND r.business_date=i.business_date WHERE i.realization_status='REALIZED'
    ), charges AS(
      SELECT COALESCE(sum(c.amount),0) amount FROM revenue.pool_charge c JOIN latest_run r ON r.pool_id=c.pool_id AND r.business_date=c.business_date
    ), allocations AS(
      SELECT COALESCE(sum(a.amount),0) amount FROM calculation.allocation_result a JOIN latest_run r ON r.run_id=a.run_id
    ), concentration AS(
      SELECT COALESCE(max(ap.outstanding_amount*av.percentage/100),0) maximum FROM pooling.asset_allocation_version av JOIN pooling.asset_position ap ON ap.asset_id=av.asset_id JOIN latest_run r ON r.pool_id=av.pool_id WHERE av.effective_from<=r.business_date AND(av.effective_to IS NULL OR av.effective_to>r.business_date)
    ), reserves AS(
      SELECT COALESCE(max(m.closing_balance)FILTER(WHERE m.reserve_type='PER'),0) per_balance,COALESCE(max(m.closing_balance)FILTER(WHERE m.reserve_type='IRR'),0) irr_balance FROM calculation.reserve_movement m JOIN latest_run r ON r.run_id=m.run_id
    ), dcr AS(
      SELECT d.dcr_value,d.state FROM risk.dcr_calculation d JOIN latest_run r ON r.pool_id=d.pool_id AND r.business_date=d.business_date ORDER BY d.calculated_at DESC LIMIT 1
    )SELECT r.run_id::text,r.pool_id,r.business_date::text,c.currency_code,
      CASE WHEN c.invested_amount=0 THEN 0 ELSE i.amount/c.invested_amount END::text pool_profit_rate,
      CASE WHEN c.total_resources=0 THEN 0 ELSE a.amount/c.total_resources END::text distributed_profit_rate,
      (CASE WHEN c.total_resources=0 THEN 0 ELSE a.amount/c.total_resources END-CASE WHEN c.invested_amount=0 THEN 0 ELSE i.amount/c.invested_amount END)::text yield_gap,
      (i.amount-ch.amount-a.amount)::text bank_margin,c.total_resources::text,c.invested_amount::text,NULL::text average_duration_days,
      CASE WHEN c.invested_amount=0 THEN 0 ELSE x.maximum/c.invested_amount END::text asset_concentration_rate,c.maturity_gaps,c.currency_gaps,
      CASE WHEN COALESCE(r.distributable_amount,0)=0 THEN 0 ELSE rs.per_balance/r.distributable_amount END::text per_coverage_rate,
      CASE WHEN COALESCE(r.distributable_amount,0)=0 THEN 0 ELSE rs.irr_balance/r.distributable_amount END::text irr_coverage_rate,
      d.dcr_value::text,d.state dcr_state
    FROM latest_run r JOIN composition c ON true CROSS JOIN income i CROSS JOIN charges ch CROSS JOIN allocations a CROSS JOIN concentration x CROSS JOIN reserves rs LEFT JOIN dcr d ON true`, [poolId]);
    const row = result.rows[0];
    if (!row) return undefined;
    const warnings = [
      ...(row.average_duration_days === null ? ['AVERAGE_DURATION_SOURCE_UNAVAILABLE'] : []),
      ...(row.dcr_value === null ? ['DCR_NOT_CALCULATED_FOR_PUBLISHED_RUN'] : []),
    ];
    return {
      runId:row.run_id,poolId:row.pool_id,businessDate:row.business_date,currency:row.currency_code,
      poolProfitRate:row.pool_profit_rate,distributedProfitRate:row.distributed_profit_rate,yieldGap:row.yield_gap,bankMargin:row.bank_margin,
      totalResources:row.total_resources,investedAmount:row.invested_amount,averageDurationDays:row.average_duration_days,
      assetConcentrationRate:row.asset_concentration_rate,maturityGaps:row.maturity_gaps,currencyGaps:row.currency_gaps,
      perCoverageRate:row.per_coverage_rate,irrCoverageRate:row.irr_coverage_rate,dcrValue:row.dcr_value,dcrState:row.dcr_state,
      source:'LATEST_PUBLISHED_RUN',dataQualityWarnings:warnings,
    };
  }
}
