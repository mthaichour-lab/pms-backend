import type{Pool}from'pg';
import type{CalculationStepRepository,CalculationStepRequest}from'../../modules/profit-calculation/application/execute-calculation-step.js';
export class PostgresCalculationStepRepository implements CalculationStepRepository{
  constructor(private readonly pool:Pick<Pool,'connect'>){}
  async executeOnce(request:CalculationStepRequest,operation:()=>Promise<string>):Promise<{status:'COMPLETED'|'ALREADY_COMPLETED';outputChecksumSha256:string}>{
    const client=await this.pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`calculation.step.${request.runId}.${request.stepName}`]);
      const checkpoint=await client.query<{status:string;input_checksum_sha256:string;output_checksum_sha256:string|null}>(`SELECT status,input_checksum_sha256,output_checksum_sha256 FROM calculation.run_step WHERE run_id=$1::uuid AND step_name=$2 FOR UPDATE`,[request.runId,request.stepName]);const existing=checkpoint.rows[0];
      if(existing&&existing.input_checksum_sha256!==request.inputChecksumSha256)throw new Error('Calculation step identifier conflicts with a different input checksum');
      if(existing?.status==='COMPLETED'&&existing.output_checksum_sha256){await client.query('COMMIT');return{status:'ALREADY_COMPLETED',outputChecksumSha256:existing.output_checksum_sha256};}
      if(existing)await client.query(`UPDATE calculation.run_step SET status='RUNNING',attempt_count=attempt_count+1,started_at=clock_timestamp(),completed_at=NULL,failure_message=NULL WHERE run_id=$1::uuid AND step_name=$2`,[request.runId,request.stepName]);
      else await client.query(`INSERT INTO calculation.run_step(run_id,step_name,input_checksum_sha256,status)VALUES($1::uuid,$2,$3,'RUNNING')`,[request.runId,request.stepName,request.inputChecksumSha256]);
      const outputChecksumSha256=await operation();if(!/^[a-f0-9]{64}$/.test(outputChecksumSha256))throw new TypeError('Calculation step output must be a SHA-256 checksum');
      await client.query(`UPDATE calculation.run_step SET status='COMPLETED',output_checksum_sha256=$3,completed_at=clock_timestamp() WHERE run_id=$1::uuid AND step_name=$2`,[request.runId,request.stepName,outputChecksumSha256]);await client.query('COMMIT');return{status:'COMPLETED',outputChecksumSha256};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
}
