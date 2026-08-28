import { startWorker } from '../../../src/infrastructure/runtime/worker-runtime.js';
import { calculationWorker } from './worker.js';

startWorker(calculationWorker);
