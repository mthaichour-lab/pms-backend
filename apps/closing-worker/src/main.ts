import { startWorker } from '../../../src/infrastructure/runtime/worker-runtime.js';
import { closingWorker } from './worker.js';

startWorker(closingWorker);
