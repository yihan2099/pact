import { describe, test, expect, beforeEach } from 'bun:test';
import { setupViemMock } from '../helpers/mock-viem';

const viemMock = setupViemMock();

const {
  getChain,
  getPublicClient,
  getDefaultRpcUrl,
  resetPublicClient,
  getBlockNumber,
  getBalance,
  waitForTransaction,
} = await import('../../client/public-client');

describe('public-client', () => {
  beforeEach(() => {
    resetPublicClient();
    viemMock.reset();
    process.env.CHAIN_ID = '84532';
  });

  describe('getChain', () => {
    test('returns Base Sepolia for 84532', () => {
      const chain = getChain(84532);
      expect(chain).toBeDefined();
    });

    test('returns Base for 8453', () => {
      const chain = getChain(8453);
      expect(chain).toBeDefined();
    });

    test('returns local Anvil for 31337', () => {
      const chain = getChain(31337);
      expect(chain).toBeDefined();
    });

    test('throws for unsupported chain', () => {
      expect(() => getChain(999)).toThrow('Unsupported chain ID: 999');
    });
  });

  describe('getDefaultRpcUrl', () => {
    test('returns Sepolia URL for 84532', () => {
      const url = getDefaultRpcUrl(84532);
      expect(url).toBe('https://sepolia.base.org');
    });

    test('returns mainnet URL for 8453', () => {
      const url = getDefaultRpcUrl(8453);
      expect(url).toBe('https://mainnet.base.org');
    });

    test('returns localhost for 31337', () => {
      const url = getDefaultRpcUrl(31337);
      expect(url).toContain('127.0.0.1');
    });

    test('throws for unsupported chain', () => {
      expect(() => getDefaultRpcUrl(999)).toThrow('No default RPC URL for chain ID: 999');
    });
  });

  describe('getPublicClient', () => {
    test('creates client on first call', () => {
      const client = getPublicClient(84532);
      expect(client).toBeDefined();
      expect(viemMock.mockCreatePublicClient).toHaveBeenCalledTimes(1);
    });

    test('caches client for same chain', () => {
      const client1 = getPublicClient(84532);
      const client2 = getPublicClient(84532);
      expect(client1).toBe(client2);
      expect(viemMock.mockCreatePublicClient).toHaveBeenCalledTimes(1);
    });

    test('creates separate clients for different chains', () => {
      getPublicClient(84532);
      getPublicClient(8453);
      expect(viemMock.mockCreatePublicClient).toHaveBeenCalledTimes(2);
    });

    test('accepts custom RPC URL', () => {
      const client = getPublicClient(84532, 'https://custom-rpc.example.com');
      expect(client).toBeDefined();
    });
  });

  describe('resetPublicClient', () => {
    test('clears cached clients', () => {
      getPublicClient(84532);
      expect(viemMock.mockCreatePublicClient).toHaveBeenCalledTimes(1);

      resetPublicClient();
      getPublicClient(84532);
      expect(viemMock.mockCreatePublicClient).toHaveBeenCalledTimes(2);
    });
  });

  describe('getBlockNumber', () => {
    test('returns block number', async () => {
      const blockNumber = await getBlockNumber(84532);
      expect(blockNumber).toBe(12345n);
    });
  });

  describe('getBalance', () => {
    test('returns ETH balance', async () => {
      const balance = await getBalance(
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
        84532
      );
      expect(balance).toBe(1000000000000000000n);
    });
  });

  describe('waitForTransaction', () => {
    test('returns receipt details', async () => {
      const result = await waitForTransaction('0xhash' as `0x${string}`, 84532);
      expect(result.blockNumber).toBe(100n);
      expect(result.status).toBe('success');
      expect(result.gasUsed).toBe(21000n);
      expect(result.effectiveGasPrice).toBe(1000000000n);
    });
  });
});
