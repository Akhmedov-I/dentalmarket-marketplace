import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly uploadRootDir = path.join(process.cwd(), 'uploads');

  onModuleInit() {
    // Ensure root uploads directory exists
    if (!fs.existsSync(this.uploadRootDir)) {
      fs.mkdirSync(this.uploadRootDir, { recursive: true });
    }
  }

  /**
   * Saves a file locally in the specified subfolder, calculating its SHA-256 hash.
   * @param file The uploaded Multer file object
   * @param subfolder Subfolder name (e.g. 'certificates', 'products')
   * @returns The relative file object key and its SHA-256 hex digest
   */
  async saveFile(
    file: { buffer: Buffer; originalname: string },
    subfolder: string,
  ): Promise<{ objectKey: string; sha256: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Invalid file upload request');
    }

    const folderPath = path.join(this.uploadRootDir, subfolder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    const filePath = path.join(folderPath, filename);

    // Save file to disk
    await fs.promises.writeFile(filePath, file.buffer);

    // Compute SHA-256 hash
    const sha256 = crypto
      .createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    // Return the relative object key for database storage
    const objectKey = `uploads/${subfolder}/${filename}`;

    return {
      objectKey,
      sha256,
    };
  }

  /**
   * Deletes a file from the local storage disk
   * @param objectKey The relative file object key
   */
  async deleteFile(objectKey: string): Promise<void> {
    const fullPath = path.join(process.cwd(), objectKey);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  }

  /**
   * Returns the absolute path of a file for download/retrieval
   */
  getAbsolutePath(objectKey: string): string {
    const fullPath = path.join(process.cwd(), objectKey);
    if (!fs.existsSync(fullPath)) {
      throw new BadRequestException('Requested file does not exist');
    }
    return fullPath;
  }
}
