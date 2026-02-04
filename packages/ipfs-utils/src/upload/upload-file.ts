import { getPinataClient } from '../client/pinata-client';
import { IpfsUploadError } from './upload-json';

export interface UploadFileOptions {
  /** Metadata name for the file */
  name?: string;
  /** Key-value metadata */
  keyvalues?: Record<string, string>;
  /** Timeout in milliseconds (default: 60000 for files) */
  timeoutMs?: number;
}

export interface FileUploadResult {
  /** IPFS CID */
  cid: string;
  /** Size in bytes */
  size: number;
  /** Original filename */
  name: string;
  /** MIME type */
  mimeType: string;
  /** Timestamp */
  timestamp: string;
}

/**
 * Upload a file to IPFS via Pinata with error handling
 */
export async function uploadFile(
  file: File,
  options: UploadFileOptions = {}
): Promise<FileUploadResult> {
  const { timeoutMs = 60000, ...pinataOptions } = options;

  try {
    const pinata = getPinataClient();

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const upload = await pinata.upload.file(file, {
        metadata: {
          name: pinataOptions.name || file.name,
          keyvalues: pinataOptions.keyvalues,
        },
      });

      clearTimeout(timeoutId);

      return {
        cid: upload.cid,
        size: upload.size,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // Check if timeout
      if (controller.signal.aborted) {
        throw new IpfsUploadError(`IPFS file upload timed out after ${timeoutMs}ms`);
      }

      throw error;
    }
  } catch (error) {
    // Already an IpfsUploadError
    if (error instanceof IpfsUploadError) {
      throw error;
    }

    // Wrap other errors
    const message = error instanceof Error ? error.message : String(error);
    throw new IpfsUploadError(
      `Failed to upload file to IPFS: ${message}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Upload a blob to IPFS via Pinata
 */
export async function uploadBlob(
  blob: Blob,
  filename: string,
  options: UploadFileOptions = {}
): Promise<FileUploadResult> {
  const file = new File([blob], filename, { type: blob.type });
  return uploadFile(file, options);
}

/**
 * Upload raw bytes to IPFS via Pinata
 */
export async function uploadBytes(
  bytes: ArrayBuffer,
  filename: string,
  mimeType: string = 'application/octet-stream',
  options: UploadFileOptions = {}
): Promise<FileUploadResult> {
  const blob = new Blob([bytes], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });
  return uploadFile(file, options);
}
