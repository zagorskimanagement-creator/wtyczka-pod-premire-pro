import { Queue } from 'bullmq';
import { redisClient } from '../lib/redis.js';

const getConnection = () => ({ connection: redisClient });

export interface TranscriptionJob { projectId: string; videoId: string; storagePath: string; durationSeconds: number; }
export interface AnalysisJob { projectId: string; videoId: string; transcriptId?: string; options: { targetDuration: number; targetPlatform: string; captionStyle: string; removeFillers: boolean; removeSilence: boolean; removeRepetitions: boolean; detectHooks: boolean; detectEmotions: boolean; generateTitle: boolean; generateDescription: boolean; generateHashtags: boolean; addBRoll: boolean }; }
export interface EditGenerationJob { projectId: string; videoId: string; analysisId: string; options: { clipCount: number; targetDurationSeconds: number; platform: string; captionStyle: string; includeZooms: boolean; includePunchIns: boolean; includeTransitions: boolean; aspectRatio: string }; }
export interface ExportJob { exportId: string; clipId: string; projectId: string; storagePath: string; startMs: number; endMs: number; captions: Array<{ text: string; startMs: number; endMs: number; positionX: number; positionY: number; fontSize: number; colorHex: string; strokeColor: string; strokeWidth: number }>; options: { platform: string; resolution: string; format: string; quality: string; watermark: boolean }; }

export class QueueService {
  private transcriptionQueue: Queue;
  private analysisQueue: Queue;
  private editQueue: Queue;
  private exportQueue: Queue;

  constructor() {
    const opts = getConnection();
    this.transcriptionQueue = new Queue('transcription', opts);
    this.analysisQueue = new Queue('analysis', opts);
    this.editQueue = new Queue('edit-generation', opts);
    this.exportQueue = new Queue('export', opts);
  }

  async enqueueTranscription(data: TranscriptionJob): Promise<string> {
    const job = await this.transcriptionQueue.add('transcribe', data, { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: { age: 86400, count: 1000 }, removeOnFail: { age: 604800 } });
    return job.id ?? '';
  }

  async enqueueAnalysis(data: AnalysisJob): Promise<string> {
    const job = await this.analysisQueue.add('analyze', data, { attempts: 3, backoff: { type: 'exponential', delay: 10000 }, removeOnComplete: { age: 86400, count: 1000 }, removeOnFail: { age: 604800 }, timeout: 300000 });
    return job.id ?? '';
  }

  async enqueueEditGeneration(data: EditGenerationJob): Promise<string> {
    const job = await this.editQueue.add('generate-edit', data, { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: { age: 86400, count: 1000 }, removeOnFail: { age: 604800 }, timeout: 120000 });
    return job.id ?? '';
  }

  async enqueueExport(data: ExportJob): Promise<string> {
    const job = await this.exportQueue.add('export', data, { attempts: 3, backoff: { type: 'exponential', delay: 10000 }, removeOnComplete: { age: 86400, count: 100 }, removeOnFail: { age: 604800 }, timeout: 600000 });
    return job.id ?? '';
  }

  async getJobStatus(queueName: string, jobId: string) {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (!job) return null;
    return { id: job.id, state: await job.getState(), progress: job.progress, data: job.data, result: job.returnvalue, failedReason: job.failedReason, attemptsMade: job.attemptsMade };
  }

  private getQueue(name: string): Queue {
    switch (name) { case 'transcription': return this.transcriptionQueue; case 'analysis': return this.analysisQueue; case 'edit-generation': return this.editQueue; case 'export': return this.exportQueue; default: throw new Error(`Unknown queue: ${name}`); }
  }

  async close() { await Promise.all([this.transcriptionQueue.close(), this.analysisQueue.close(), this.editQueue.close(), this.exportQueue.close()]); }
}
