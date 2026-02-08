import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { setupPinataMock } from '../helpers/mock-pinata';

// Set env vars before importing source
process.env.PINATA_JWT = 'test-jwt-token';
process.env.PINATA_GATEWAY = 'https://test.mypinata.cloud';

// Setup SDK mock BEFORE importing source
const pinataMock = setupPinataMock();

// Mock global fetch
const mockFetch = mock(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ title: 'Test Task', version: '1.0' }),
  } as Response)
);
globalThis.fetch = mockFetch as any;

// Import real modules
const { resetPinataClient } = await import('../../client/pinata-client');
const { fetchJson } = await import('../../fetch/fetch-json');

describe('fetch-json', () => {
  beforeEach(() => {
    resetPinataClient();
    pinataMock.reset();
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ title: 'Test', version: '1.0' }),
    } as Response);
  });

  describe('fetchJson', () => {
    test('fetches JSON from IPFS by CID', async () => {
      const result = await fetchJson('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG');
      expect(result).toEqual({ title: 'Test', version: '1.0' });
    });

    test('uses signed URL by default', async () => {
      pinataMock.setSignedUrl('https://signed.example.com/ipfs/QmTest');
      await fetchJson('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG');
      expect(pinataMock.mockCreateSignedURL).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://signed.example.com/ipfs/QmTest',
        expect.anything()
      );
    });

    test('uses public gateway when useSignedUrl is false', async () => {
      await fetchJson('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG', {
        useSignedUrl: false,
      });
      expect(pinataMock.mockCreateSignedURL).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'),
        expect.anything()
      );
    });

    test('uses custom gateway when provided', async () => {
      await fetchJson('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG', {
        gateway: 'https://custom.gateway.io',
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.gateway.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
        expect.anything()
      );
    });

    test('throws for invalid CID', async () => {
      await expect(fetchJson('invalid-cid')).rejects.toThrow('Invalid CID');
    });

    test('throws on non-OK response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);
      await expect(fetchJson('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG')).rejects.toThrow(
        'Failed to fetch CID'
      );
    });

    test('sets Accept: application/json header', async () => {
      await fetchJson('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Accept: 'application/json' },
        })
      );
    });
  });
});
