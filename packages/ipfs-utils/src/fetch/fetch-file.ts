import { getGatewayUrl, isValidCid } from '../client/pinata-client';

export interface FetchFileOptions {
  /** Custom gateway URL (overrides default) */
  gateway?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

export interface FetchedFile {
  /** File content as blob */
  blob: Blob;
  /** File content as ArrayBuffer */
  arrayBuffer: ArrayBuffer;
  /** Content type */
  contentType: string;
  /** Content length */
  contentLength: number;
  /** CID */
  cid: string;
}

/**
 * Fetch a file from IPFS by CID
 */
export async function fetchFile(
  cid: string,
  options: FetchFileOptions = {}
): Promise<FetchedFile> {
  if (!isValidCid(cid)) {
    throw new Error(`Invalid CID: ${cid}`);
  }

  const { gateway, timeout = 60000 } = options;
  const url = gateway ? `${gateway}/ipfs/${cid}` : getGatewayUrl(cid);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch CID ${cid}: ${response.status}`);
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    return {
      blob,
      arrayBuffer,
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      contentLength: parseInt(response.headers.get('content-length') || '0', 10),
      cid,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch a file and return as text
 */
export async function fetchFileAsText(
  cid: string,
  options?: FetchFileOptions
): Promise<string> {
  const file = await fetchFile(cid, options);
  return new TextDecoder().decode(file.arrayBuffer);
}

/**
 * Fetch a file and return as data URL
 */
export async function fetchFileAsDataUrl(
  cid: string,
  options?: FetchFileOptions
): Promise<string> {
  const file = await fetchFile(cid, options);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file.blob);
  });
}

/**
 * Check if a CID exists on the gateway
 */
export async function cidExists(
  cid: string,
  options: FetchFileOptions = {}
): Promise<boolean> {
  if (!isValidCid(cid)) {
    return false;
  }

  const { gateway, timeout = 10000 } = options;
  const url = gateway ? `${gateway}/ipfs/${cid}` : getGatewayUrl(cid);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
