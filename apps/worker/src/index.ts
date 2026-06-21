import { Worker, WorkerOptions } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { transcriptionProcessor } from './processors/transcription.js';
import { analysisProcessor } from './processors/analysis.js';
import { editGenerationProcessor } from './processors/edit-generation.js';
import { exportProcessor } from './processors/export.js';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const CONCURRENCY = parseInt(process.env['WORKER_CONCURRENCY'] ?? '5', 10);

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const prisma = new PrismaClient();

const workerOptions: WorkerOptions = {
  connection,
  concurrency: CONCURRENCY,
};

const transcriptionWorker = new Worker(
  'transcription',
  async (job) => transcriptionProcessor(job, prisma),
  { ...workerOptions, concurrency: 3 },
);

const analysisWorker = new Worker(
  'analysis',
  async (job) => analysisProcessor(job, prisma),
  { ...workerOptions, concurrency: 2 },
);

const editGenerationWorker = new Worker(
  'edit-generation',
  async (job) => editGenerationProcessor(job, prisma),
  { ...workerOptions, concurrency: 3 },
);

const exportWorker = new Worker(
  'export',
  async (job) => exportProcessor(job, prisma),
  { ...workerOptions, concurrency: 2 },
);

const workers = [transcriptionWorker, analysisWorker, editGenerationWorker, exportWorker];

for (const worker of workers) {
  worker.on('completed', (job) => {
    console.warn(`[Worker] Job ${job.id} (${job.name}) completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Error:', err.message);
  });
}

console.warn(`[Worker] ShortForge AI Worker started with ${CONCURRENCY} concurrency`);
console.warn('[Worker] Listening for: transcription, analysis, edit-generation, export');

async function shutdown() {
  console.warn('[Worker] Shutting down gracefully...');
  await Promise.all(workers.map((w) => w.close()));
  await prisma.$disconnect();
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', () => { void shutdown(); });
process.on('SIGINT', () => { void shutdown(); });
