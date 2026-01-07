import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const DEFAULT_MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(
    private readonly maxSizeBytes: number = DEFAULT_MAX_SIZE_BYTES,
    private readonly allowedMimeTypes: Set<string> = ALLOWED_MIME_TYPES,
  ) {}

  transform(file: Express.Multer.File | undefined): Express.Multer.File {
    if (!file) {
      throw new BadRequestException('File is required.');
    }

    if (!file.mimetype || !this.allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG and PNG are allowed.',
      );
    }

    if (typeof file.size !== 'number' || file.size <= 0) {
      throw new BadRequestException('File is empty.');
    }

    if (file.size > this.maxSizeBytes) {
      throw new BadRequestException('File size exceeds 2MB limit.');
    }

    return file;
  }
}
