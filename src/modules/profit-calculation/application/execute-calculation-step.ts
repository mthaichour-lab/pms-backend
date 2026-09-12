export interface CalculationStepRequest { runId:string;stepName:string;inputChecksumSha256:string; }
export interface CalculationStepRepository { executeOnce(request:CalculationStepRequest,operation:()=>Promise<string>):Promise<{status:'COMPLETED'|'ALREADY_COMPLETED';outputChecksumSha256:string}>; }
export class ExecuteCalculationStep {
  constructor(private readonly repository:CalculationStepRepository){}
  execute(request:CalculationStepRequest,operation:()=>Promise<string>){
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.runId))throw new TypeError('runId must be a UUID');
    if(!/^[A-Z][A-Z0-9_]{1,63}$/.test(request.stepName))throw new TypeError('stepName must be an uppercase engine step');
    if(!/^[a-f0-9]{64}$/.test(request.inputChecksumSha256))throw new TypeError('inputChecksumSha256 must be SHA-256');
    return this.repository.executeOnce(request,operation);
  }
}
