import { BadRequestException, Injectable, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { S3StorageService } from './s3-storage.service';

export const STORAGE_SERVICE = 'STORAGE_SERVICE';

export interface StorageService {
  uploadFile(file: Express.Multer.File): Promise<string>;
  deleteFile(fileUrl: string): Promise<void>;
  uploadBuffer(
    buffer: Buffer,
    mimeType: string,
    subdir?: string,
  ): Promise<string>;
  resolveImageDiskPath(imageUrl: string): string;
}

@Injectable()
export class LocalDiskStorageService implements StorageService {
  private readonly uploadsRoot: string;
  private readonly publicBaseUrl: string;
  private readonly avatarSubdir = 'avatars';

  constructor(private readonly configService: ConfigService) {
    this.uploadsRoot =
      this.configService.get<string>('UPLOADS_DIR') ?? 'uploads';
    this.publicBaseUrl =
      this.configService.get<string>('UPLOADS_BASE_URL') ?? '/uploads';
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File payload is required.');
    }

    const extension = this.resolveExtension(file);
    const filename = `${this.generateFileId()}${extension}`;
    const targetDir = path.join(this.uploadsRoot, this.avatarSubdir);

    await mkdir(targetDir, { recursive: true });

    const filePath = path.join(targetDir, filename);
    await writeFile(filePath, file.buffer);

    return this.buildPublicUrl(`${this.avatarSubdir}/${filename}`);
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
    const filename = `${this.generateFileId()}${extension}`;
    const targetDir = path.join(this.uploadsRoot, subdir);

    await mkdir(targetDir, { recursive: true });

    const filePath = path.join(targetDir, filename);
    await writeFile(filePath, buffer);

    return this.buildPublicUrl(`${subdir}/${filename}`);
  }

  resolveImageDiskPath(imageUrl: string): string {
    const relativePath = this.stripBaseUrl(imageUrl);
    if (!relativePath) {
      return path.join(this.uploadsRoot, imageUrl);
    }
    return path.join(this.uploadsRoot, relativePath);
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl) {
      return;
    }

    const relativePath = this.stripBaseUrl(fileUrl);
    if (!relativePath) {
      return;
    }

    const filePath = path.join(this.uploadsRoot, relativePath);
    try {
      await unlink(filePath);
    } catch {
      // Ignore missing files or filesystem errors.
    }
  }

  private resolveExtension(file: Express.Multer.File): string {
    const mime = file.mimetype.toLowerCase();
    if (mime === 'image/jpeg' || mime === 'image/jpg') {
      return '.jpg';
    }
    if (mime === 'image/png') {
      return '.png';
    }

    const ext = path.extname(file.originalname);
    return ext || '';
  }

  private generateFileId(): string {
    return randomBytes(16).toString('hex');
  }

  private buildPublicUrl(relativePath: string): string {
    const base = this.publicBaseUrl.replace(/\/+$/, '');
    const rel = relativePath.replace(/^\/+/, '');
    return `${base}/${rel}`;
  }

  private stripBaseUrl(fileUrl: string): string | null {
    const base = this.publicBaseUrl.replace(/\/+$/, '');
    if (fileUrl.startsWith(base)) {
      return fileUrl.slice(base.length).replace(/^\/+/, '');
    }
    if (fileUrl.startsWith('/')) {
      return fileUrl.replace(/^\/+/, '');
    }
    return null;
  }
}

@Module({
  imports: [ConfigModule],
  providers: [
    LocalDiskStorageService,
    S3StorageService,
    {
      provide: STORAGE_SERVICE,
      useFactory: (configService: ConfigService) => {
        const storageType = configService.get<string>('STORAGE_TYPE') || 'local';
        if (storageType === 's3') {
          return configService.get<S3StorageService>('s3-storage');
        }
        return configService.get<LocalDiskStorageService>('local-storage');
      },
      inject: [ConfigService],
    },
    {
      provide: 'local-storage',
      useClass: LocalDiskStorageService,
    },
    {
      provide: 's3-storage',
      useClass: S3StorageService,
    },
  ],
  exports: [LocalDiskStorageService, S3StorageService, STORAGE_SERVICE],
})
export class StorageModule {}
