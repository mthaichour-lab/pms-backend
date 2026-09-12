import { Decimal } from 'decimal.js';
export interface TenorObservation{maturityDate:string;principal:string;profit:string;}
export interface TenorGap{bucket:string;amount:string;}
export interface TenorCurvePoint{bucket:string;financingAmount:string;placementAmount:string;gap:string;servedYieldPercent:string;}
const buckets=[{name:'0-30D',max:30},{name:'31-90D',max:90},{name:'91-180D',max:180},{name:'181-365D',max:365},{name:'1-3Y',max:1095},{name:'3Y+',max:Infinity}]as const;
export function buildTenorYieldCurve(businessDate:string,observations:readonly TenorObservation[],gaps:readonly TenorGap[]):TenorCurvePoint[]{
 const origin=Date.parse(`${businessDate}T00:00:00Z`);if(!Number.isFinite(origin))throw new TypeError('Business date must use YYYY-MM-DD');
 return buckets.map((bucket,index)=>{const previous=index===0?-Infinity:buckets[index-1]!.max;const selected=observations.filter(item=>{const days=Math.ceil((Date.parse(`${item.maturityDate}T00:00:00Z`)-origin)/86_400_000);return days>previous&&days<=bucket.max;});const financing=selected.reduce((sum,item)=>sum.plus(item.principal),new Decimal(0));const profit=selected.reduce((sum,item)=>sum.plus(item.profit),new Decimal(0));const gap=new Decimal(gaps.find(item=>item.bucket===bucket.name)?.amount??0);const placement=financing.minus(gap);return{bucket:bucket.name,financingAmount:financing.toFixed(12),placementAmount:placement.toFixed(12),gap:gap.toFixed(12),servedYieldPercent:financing.isZero()?'0.000000':profit.div(financing).mul(100).toFixed(6)};});
}
