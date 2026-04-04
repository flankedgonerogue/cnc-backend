import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomBytes } from 'node:crypto';
import type { StorageService } from './storage.module';

@Injectable()
export class S3StorageService implements StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly bucketRegion: string;
  private readonly bucketUrl: string;
  private readonly awsAccessKeyId: string | undefined;
  private readonly awsSecretAccessKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.awsAccessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    this.awsSecretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );
    this.bucketName =
      this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';
    this.bucketRegion =
      this.configService.get<string>('AWS_S3_REGION') || 'us-east-1';
    this.bucketUrl =
      this.configService.get<string>('AWS_S3_URL') ||
      `https://${this.bucketName}.s3.${this.bucketRegion}.amazonaws.com`;

    if (!this.awsAccessKeyId || !this.awsSecretAccessKey || !this.bucketName) {
      this.logger.warn(
        'AWS S3 credentials or bucket name not configured. S3 uploads will fail.',
      );
    }

    this.s3Client = new S3Client({
      region: this.bucketRegion,
      credentials: {
        accessKeyId: this.awsAccessKeyId || '',
        secretAccessKey: this.awsSecretAccessKey || '',
      },
    });

    this.logger.log(
      `S3StorageService initialized with bucket: ${this.bucketName}, region: ${this.bucketRegion}`,
    );
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File payload is required.');
    }

    const extension = this.resolveExtension(file);
    const filename = `avatars/${this.generateFileId()}${extension}`;

    return this.uploadToS3(filename, file.buffer, file.mimetype);
  }

  async uploadBuffer(
    buffer: Buffer,
    mimeType: string,
    subdir: string = 'story-images',
  ): Promise<string> {
    if (!buffer?.length) {
      throw new BadRequestException('Buffer is empty.');
    }

    const extension =
      mimeType === 'image/png'
        ? '.png'
        : mimeType === 'audio/wav'
          ? '.wav'
          : '.jpg';
    const filename = `${subdir}/${this.generateFileId()}${extension}`;

    return this.uploadToS3(filename, buffer, mimeType);
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl) {
      return;
    }

    try {
      const key = this.extractKeyFromUrl(fileUrl);
      if (!key) {
        return;
      }

      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );

      this.logger.log(`Deleted S3 object: ${key}`);
    } catch (error) {
      this.logger.warn(
        `Failed to delete S3 object from URL ${fileUrl}: ${error}`,
      );
      // Don't throw - continue operation if deletion fails
    }
  }

  /**
   * For S3 storage, we don't have disk paths. This method is kept for
   * compatibility but returns the URL as-is since S3 URLs don't need conversion.
   */
  resolveImageDiskPath(imageUrl: string): string {
    // For S3, we just return the URL as it's already accessible
    return imageUrl;
  }

  private async uploadToS3(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );

      const url = `${this.bucketUrl}/${key}`;
      this.logger.log(`Uploaded file to S3: ${url}`);
      return url;
    } catch (error) {
      this.logger.error(`Failed to upload to S3: ${error}`);
      throw new BadRequestException(`S3 upload failed: ${error.message}`);
    }
  }

  private extractKeyFromUrl(fileUrl: string): string | null {
    if (!fileUrl) {
      return null;
    }

    // Handle bucket URL format: https://bucket.s3.region.amazonaws.com/key
    // or custom URL format: https://custom-url.com/key
    if (fileUrl.startsWith(this.bucketUrl)) {
      return fileUrl.slice(this.bucketUrl.length + 1);
    }

    // If it's already a key, return it
    if (
      !fileUrl.startsWith('http://') &&
      !fileUrl.startsWith('https://') &&
      !fileUrl.startsWith('/')
    ) {
      return fileUrl;
    }

    return null;
  }

  private resolveExtension(file: Express.Multer.File): string {
    const mime = file.mimetype.toLowerCase();
    if (mime === 'image/jpeg' || mime === 'image/jpg') {
      return '.jpg';
    }
    if (mime === 'image/png') {
      return '.png';
    }

    const parts = file.originalname.split('.');
    const ext = parts[parts.length - 1];
    return ext ? `.${ext}` : '';
  }

  private generateFileId(): string {
    return randomBytes(16).toString('hex');
  }
}
