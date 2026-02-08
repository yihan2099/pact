import { describe, test, expect, beforeEach } from 'bun:test';
import { setupViemMock } from '../helpers/mock-viem';

const viemMock = setupViemMock();

const {
  verifySignature,
  recoverSigner,
  hashEthMessage,
  keccak256Hash,
  createAuthChallenge,
  parseAuthChallenge,
  isTimestampFresh,
} = await import('../../utils/signature');

describe('signature utils', () => {
  beforeEach(() => {
    viemMock.reset();
  });

  describe('verifySignature', () => {
    test('returns true when recovered address matches', async () => {
      viemMock.mockRecoverMessageAddress.mockResolvedValue('0xABC123' as any);
      const result = await verifySignature('message', '0xsig' as any, '0xabc123' as any);
      expect(result).toBe(true);
    });

    test('returns true with case-insensitive comparison', async () => {
      viemMock.mockRecoverMessageAddress.mockResolvedValue('0xABC123' as any);
      const result = await verifySignature('message', '0xsig' as any, '0xABC123' as any);
      expect(result).toBe(true);
    });

    test('returns false when addresses do not match', async () => {
      viemMock.mockRecoverMessageAddress.mockResolvedValue('0xother' as any);
      const result = await verifySignature('message', '0xsig' as any, '0xabc123' as any);
      expect(result).toBe(false);
    });

    test('returns false when recovery throws', async () => {
      viemMock.mockRecoverMessageAddress.mockRejectedValue(new Error('Invalid signature'));
      const result = await verifySignature('message', '0xbad' as any, '0xabc123' as any);
      expect(result).toBe(false);
    });

    test('passes message and signature to recoverMessageAddress', async () => {
      viemMock.mockRecoverMessageAddress.mockResolvedValue('0xabc' as any);
      await verifySignature('test message', '0xsig123' as any, '0xabc' as any);
      expect(viemMock.mockRecoverMessageAddress).toHaveBeenCalledWith({
        message: 'test message',
        signature: '0xsig123',
      });
    });
  });

  describe('recoverSigner', () => {
    test('returns recovered address', async () => {
      viemMock.mockRecoverMessageAddress.mockResolvedValue('0xabc123' as any);
      const result = await recoverSigner('message', '0xsig' as any);
      expect(result).toBe('0xabc123');
    });

    test('propagates errors', async () => {
      viemMock.mockRecoverMessageAddress.mockRejectedValue(new Error('Invalid'));
      await expect(recoverSigner('msg', '0xsig' as any)).rejects.toThrow('Invalid');
    });
  });

  describe('hashEthMessage', () => {
    test('delegates to viem hashMessage', () => {
      const result = hashEthMessage('hello');
      expect(viemMock.mockHashMessage).toHaveBeenCalledWith('hello');
      expect(result).toBe('0xhashed');
    });
  });

  describe('keccak256Hash', () => {
    test('hashes string input', () => {
      keccak256Hash('test data');
      expect(viemMock.mockToBytes).toHaveBeenCalledWith('test data');
      expect(viemMock.mockKeccak256).toHaveBeenCalled();
    });

    test('hashes Uint8Array input directly', () => {
      const bytes = new Uint8Array([1, 2, 3]);
      keccak256Hash(bytes);
      expect(viemMock.mockKeccak256).toHaveBeenCalledWith(bytes);
    });
  });

  describe('createAuthChallenge', () => {
    test('creates challenge with address and nonce', () => {
      const challenge = createAuthChallenge('0xabc' as any, 'nonce123');
      expect(challenge).toContain('Address: 0xabc');
      expect(challenge).toContain('Nonce: nonce123');
      expect(challenge).toContain('Pact Authentication');
    });

    test('uses custom domain', () => {
      const challenge = createAuthChallenge('0xabc' as any, 'n1', 'CustomDomain');
      expect(challenge).toContain('CustomDomain Authentication');
    });

    test('includes timestamp', () => {
      const challenge = createAuthChallenge('0xabc' as any, 'n1');
      expect(challenge).toContain('Timestamp:');
    });

    test('includes sign instruction', () => {
      const challenge = createAuthChallenge('0xabc' as any, 'n1');
      expect(challenge).toContain('Sign this message to authenticate with Pact.');
    });
  });

  describe('parseAuthChallenge', () => {
    test('parses address, nonce, and timestamp', () => {
      const challenge = [
        'Pact Authentication',
        '',
        'Address: 0xabc123',
        'Nonce: nonce456',
        'Timestamp: 2025-01-01T00:00:00Z',
        '',
        'Sign this message to authenticate with Pact.',
      ].join('\n');

      const result = parseAuthChallenge(challenge);
      expect(result.address).toBe('0xabc123');
      expect(result.nonce).toBe('nonce456');
      expect(result.timestamp).toBe('2025-01-01T00:00:00Z');
    });

    test('returns undefined for missing fields', () => {
      const result = parseAuthChallenge('Just some text\nWithout proper format');
      expect(result.address).toBeUndefined();
      expect(result.nonce).toBeUndefined();
      expect(result.timestamp).toBeUndefined();
    });

    test('handles values containing colons', () => {
      const challenge = 'Address: 0x123:456\nNonce: abc';
      const result = parseAuthChallenge(challenge);
      expect(result.address).toBe('0x123:456');
    });
  });

  describe('isTimestampFresh', () => {
    test('returns true for recent timestamp', () => {
      const recent = new Date().toISOString();
      expect(isTimestampFresh(recent)).toBe(true);
    });

    test('returns false for expired timestamp', () => {
      const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      expect(isTimestampFresh(old)).toBe(false);
    });

    test('returns false for future timestamp beyond tolerance', () => {
      const future = new Date(Date.now() + 60000).toISOString();
      expect(isTimestampFresh(future)).toBe(false);
    });

    test('returns true for future timestamp within tolerance', () => {
      const slight = new Date(Date.now() + 20000).toISOString();
      expect(isTimestampFresh(slight)).toBe(true);
    });

    test('accepts custom maxAge', () => {
      const old = new Date(Date.now() - 2000).toISOString();
      expect(isTimestampFresh(old, 1000)).toBe(false);
      expect(isTimestampFresh(old, 5000)).toBe(true);
    });

    test('returns true for invalid timestamp (NaN comparisons fall through)', () => {
      expect(isTimestampFresh('not-a-date')).toBe(true);
    });
  });
});
