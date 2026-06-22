import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs/promises';
import path from 'path';

export class StorageService {
  private s3: S3Client | null = null;
  private bucket: string;
  private useS3: boolean;
  private localStoragePath: string;

  constructor() {
    this.bucket = process.env['S3_BUCKET'] ?? 'shortforge-videos';
    this.useS3 = !!(process.env['AWS_ACCESS_KEY_ID'] && process.env['AWS_SECRET_ACCESS_KEY']);
    this.localStoragePath = process.env['LOCAL_STORAGE_PATH'] ?? '/tmp/shortforge/storage';
    if (this.useS3) {
      this.s3 = new S3Client({ region: process.env['AWS_REGION'] ?? 'us-east-1', credentials: { accessKeyId: process.env['AWS_ACCESS_KEY_ID']!, secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY']! }, ...(process.env['S3_ENDPOINT'] ? { endpoint: process.env['S3_ENDPOINT'] } : {}) });
    }
  }

  async upload(localPath: string, filename: string): Promise<string> {
    const storagePath = `videos/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${filename}`;
    if (this.useS3 && this.s3) {
      await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: storagePath, Body: await fs.readFile(localPath), ContentType: this.getMimeType(filename), ServerSideEncryption: 'AES256' }));
    } else {
      const destPath = path.join(this.localStoragePath, storagePath);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(localPath, destPath);
    }
    return storagePath;
  }

  async download(storagePath: string, localPath: string): Promise<void> {
    if (this.useS3 && this.s3) {
      const response = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: storagePath }));
      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
      await fs.writeFile(localPath, Buffer.concat(chunks));
    } else {
      await fs.mkdir(path.dirname(localPath), { recursive: true });
      await fs.copyFile(path.join(this.localStoragePath, storagePath), localPath);
    }
  }

  async getSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
    if (this.useS3 && this.s3) return awsGetSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: storagePath }), { expiresIn: expiresInSeconds });
    return `${process.env['APP_URL'] ?? 'http://localhost:3001'}/files/${storagePath}`;
  }

  async delete(storagePath: string): Promise<void> {
    if (this.useS3 && this.s3) await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storagePath }));
    else await fs.unlink(path.join(this.localStoragePath, storagePath)).catch(() => null);
  }

  async getLocalPath(storagePath: string): Promise<string> {
    const tmpPath = `/tmp/shortforge/processing/${path.basename(storagePath)}`;
    await this.download(storagePath, tmpPath);
    return tmpPath;
  }

  private getMimeType(filename: string): string {
    const mimeTypes: Record<string, string> = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.webm': 'video/webm', '.mkv': 'video/x-matroska' };
    return mimeTypes[path.extname(filename).toLowerCase()] ?? 'application/octet-stream';
  }
}
