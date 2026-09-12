import{createHash}from'node:crypto';
import type{LossCause}from'../../../../libs/engine/src/loss-classification.js';

export interface RecordLossNotificationCommand{lossEventId:string;notificationId:string;runId:string;accountId:string;cause:LossCause;liability:'BANK'|'INVESTORS';accountImpact:string;currencyCode:string;}
export interface LossNotificationRecord{command:RecordLossNotificationCommand;notificationType:'ACCOUNT_PROTECTED'|'ACCOUNT_AFFECTED';messageCode:'LOSS_ABSORBED_BY_BANK_ACCOUNT_UNAFFECTED'|'LOSS_ALLOCATED_TO_INVESTOR_ACCOUNT';explanationSnapshot:Record<string,string>;snapshotChecksumSha256:string;}
export interface LossNotificationRepository{save(record:LossNotificationRecord):Promise<{status:'RECORDED'|'ALREADY_RECORDED'}>;}
export class RecordLossNotification{
  constructor(private readonly repository:LossNotificationRepository){}
  execute(command:RecordLossNotificationCommand){
    for(const [field,value]of Object.entries({lossEventId:command.lossEventId,notificationId:command.notificationId,runId:command.runId,accountId:command.accountId}))if(!uuid(value))throw new TypeError(`${field} must be a UUID`);
    if(!/^[A-Z]{3}$/.test(command.currencyCode))throw new TypeError('currencyCode must be ISO 4217 uppercase');
    if(!/^(0|[1-9]\d*)(?:\.\d+)?$/.test(command.accountImpact))throw new TypeError('accountImpact must be a canonical non-negative decimal string');
    const impactIsZero=/^0(?:\.0+)?$/.test(command.accountImpact);
    if(command.liability==='BANK'&&!impactIsZero)throw new RangeError('A bank-liability loss cannot affect the investor account');
    if(command.liability==='INVESTORS'&&impactIsZero)throw new RangeError('An investor-liability notification must state the account impact');
    const notificationType=command.liability==='BANK'?'ACCOUNT_PROTECTED':'ACCOUNT_AFFECTED';
    const messageCode=command.liability==='BANK'?'LOSS_ABSORBED_BY_BANK_ACCOUNT_UNAFFECTED':'LOSS_ALLOCATED_TO_INVESTOR_ACCOUNT';
    const explanationSnapshot={cause:command.cause,liability:command.liability,accountImpact:command.accountImpact,currencyCode:command.currencyCode,messageCode};
    const snapshotChecksumSha256=createHash('sha256').update(JSON.stringify(explanationSnapshot)).digest('hex');
    return this.repository.save({command,notificationType,messageCode,explanationSnapshot,snapshotChecksumSha256});
  }
}
function uuid(value:string){return/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);}
