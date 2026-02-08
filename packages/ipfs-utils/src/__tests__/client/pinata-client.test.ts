import { describe, test, expect, beforeEach } from 'bun:test';
import { setupPinataMock } from '../helpers/mock-pinata';

// Set env vars before importing source
process.env.PINATA_JWT = 'test-jwt';
process.env.PINATA_GATEWAY = 'https://test-gateway.pinata.cloud';

// Setup mock BEFORE importing source
const pinataMock = setupPinataMock();

// Import real modules - they will use the mocked PinataSDK
const {
  getPinataClient,
  resetPinataClient,
  getGatewayUrl,
  getSignedGatewayUrl,
  isValidCid,
  getPublicGroupId,
} = await import('../../client/pinata-client');

describe('pinata-client', () => {
  beforeEach(() => {
    resetPinataClient();
    pinataMock.reset();
    process.env.PINATA_JWT = 'test-jwt';
    process.env.PINATA_GATEWAY = 'https://test-gateway.pinata.cloud';
    delete process.env.PINATA_PUBLIC_GROUP_ID;
  });

  describe('getPinataClient', () => {
    test('creates client with JWT', () => {
      const client = getPinataClient();
      expect(client).toBeDefined();
      expect(client.upload).toBeDefined();
      expect(client.gateways).toBeDefined();
    });

    test('caches client instance', () => {
      const client1 = getPinataClient();
      const client2 = getPinataClient();
      expect(client1).toBe(client2);
    });

    test('throws when JWT is missing', () => {
      delete process.env.PINATA_JWT;
      expect(() => getPinataClient()).toThrow('Missing Pinata environment variables');
    });

    test('works without gateway env var', () => {
      delete process.env.PINATA_GATEWAY;
      const client = getPinataClient();
      expect(client).toBeDefined();
    });
  });

  describe('resetPinataClient', () => {
    test('forces new client creation', () => {
      const client1 = getPinataClient();
      resetPinataClient();
      const client2 = getPinataClient();
      expect(client1).not.toBe(client2);
    });
  });

  describe('getGatewayUrl', () => {
    test('constructs URL with configured gateway', () => {
      const url = getGatewayUrl('QmTest123');
      expect(url).toBe('https://test-gateway.pinata.cloud/ipfs/QmTest123');
    });

    test('uses default gateway when env var not set', () => {
      delete process.env.PINATA_GATEWAY;
      const url = getGatewayUrl('QmTest123');
      expect(url).toBe('https://gateway.pinata.cloud/ipfs/QmTest123');
    });
  });

  describe('getSignedGatewayUrl', () => {
    test('calls createSignedURL with cid and expires', async () => {
      pinataMock.setSignedUrl('https://signed.example.com/test');
      const url = await getSignedGatewayUrl('QmTest123', 600);
      expect(url).toBe('https://signed.example.com/test');
      expect(pinataMock.mockCreateSignedURL).toHaveBeenCalledWith({
        cid: 'QmTest123',
        expires: 600,
      });
    });

    test('uses default expiry of 300 seconds', async () => {
      await getSignedGatewayUrl('QmTest123');
      expect(pinataMock.mockCreateSignedURL).toHaveBeenCalledWith({
        cid: 'QmTest123',
        expires: 300,
      });
    });
  });

  describe('isValidCid', () => {
    test('validates CIDv0 (Qm...)', () => {
      expect(isValidCid('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG')).toBe(true);
    });

    test('rejects invalid CIDv0', () => {
      expect(isValidCid('Qm123')).toBe(false);
    });

    test('validates CIDv1 (b...)', () => {
      expect(isValidCid('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi')).toBe(true);
    });

    test('rejects invalid CIDv1 with wrong characters', () => {
      expect(isValidCid('bafybeig0189AAAAAAAAAAAAAAAAAAAAAAAAaaaaa')).toBe(false);
    });

    test('rejects empty string', () => {
      expect(isValidCid('')).toBe(false);
    });

    test('rejects random string', () => {
      expect(isValidCid('not-a-cid')).toBe(false);
    });

    test('rejects CID with invalid base32 digits (0, 1, 8, 9)', () => {
      expect(isValidCid('bafybeig0189aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(false);
    });
  });

  describe('getPublicGroupId', () => {
    test('returns undefined when not set', () => {
      expect(getPublicGroupId()).toBeUndefined();
    });

    test('returns group ID when set', () => {
      process.env.PINATA_PUBLIC_GROUP_ID = 'group-123';
      expect(getPublicGroupId()).toBe('group-123');
      delete process.env.PINATA_PUBLIC_GROUP_ID;
    });
  });
});
