import { getPinataClient } from '../client/pinata-client';

export interface UploadFileOptions {
  /** Metadata name for the file */
  name?: string;
  /** Key-value metadata */
  keyvalues?: Record<string, string>;
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
 * Upload a file to IPFS via Pinata
 */
export async function uploadFile(
  file: File,
  options: UploadFileOptions = {}
): Promise<FileUploadResult> {
  const pinata = getPinataClient();

  const upload = await pinata.upload.file(file, {
    metadata: {
      name: options.name || file.name,
      keyvalues: options.keyvalues,
    },
  });

  return {
    cid: upload.cid,
    size: upload.size,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    timestamp: new Date().toISOString(),
  };
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
