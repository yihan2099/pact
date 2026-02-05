import { PinataSDK } from 'pinata';

let pinataClient: PinataSDK | null = null;

/**
 * Get the Pinata client instance
 * Creates a new client if one doesn't exist
 */
export function getPinataClient(): PinataSDK {
  if (pinataClient) {
    return pinataClient;
  }

  const pinataJwt = process.env.PINATA_JWT;
  const pinataGateway = process.env.PINATA_GATEWAY;

  if (!pinataJwt) {
    throw new Error('Missing Pinata environment variables. Please set PINATA_JWT.');
  }

  pinataClient = new PinataSDK({
    pinataJwt,
    pinataGateway,
  });

  return pinataClient;
}

/**
 * Reset the Pinata client (useful for testing)
 */
export function resetPinataClient(): void {
  pinataClient = null;
}

/**
 * Get the IPFS gateway URL for a CID
 */
export function getGatewayUrl(cid: string): string {
  const gateway = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud';
  return `${gateway}/ipfs/${cid}`;
}

/**
 * Get a signed URL for private content access
 * Expires in 5 minutes by default
 */
export async function getSignedGatewayUrl(
  cid: string,
  expiresSeconds: number = 300
): Promise<string> {
  const pinata = getPinataClient();
  return pinata.gateways.createSignedURL({
    cid,
    expires: expiresSeconds,
  });
}

/**
 * Check if a CID is valid
 *
 * CIDv0: Starts with "Qm", base58btc encoded, exactly 46 characters
 * CIDv1: Starts with "b", base32lower encoded, variable length (typically 50-64 chars)
 *        Uses only base32 alphabet: a-z and 2-7 (no 0, 1, 8, 9)
 */
export function isValidCid(cid: string): boolean {
  // CIDv0: Qm + 44 base58 characters = 46 total
  const cidV0Regex = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;

  // CIDv1 base32lower: b + 32-100 base32 characters (allows various codecs/hashes)
  // Base32 alphabet is [a-z2-7] - numbers 0, 1, 8, 9 are NOT valid
  const cidV1Regex = /^b[a-z2-7]{32,100}$/;

  return cidV0Regex.test(cid) || cidV1Regex.test(cid);
}

/**
 * Get the public group ID for public content uploads.
 * Returns undefined if not configured (content will be private).
 */
export function getPublicGroupId(): string | undefined {
  return process.env.PINATA_PUBLIC_GROUP_ID;
}
