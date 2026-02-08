import { mock } from 'bun:test';

// Mock readContract results - can be configured per test
let readContractResult: any = 0n;
let blockNumberResult: bigint = 12345n;
let balanceResult: bigint = 1000000000000000000n;
let txReceiptResult: any = {
  blockNumber: 100n,
  status: 'success',
  gasUsed: 21000n,
  effectiveGasPrice: 1000000000n,
};

const mockReadContract = mock(async (..._args: any[]) => readContractResult);
const mockGetBlockNumber = mock(async () => blockNumberResult);
const mockGetBalance = mock(async (..._args: any[]) => balanceResult);
const mockWaitForTransactionReceipt = mock(async (..._args: any[]) => txReceiptResult);
const mockGetTransactionReceipt = mock(async (..._args: any[]) => txReceiptResult);

export const mockPublicClient = {
  readContract: mockReadContract,
  getBlockNumber: mockGetBlockNumber,
  getBalance: mockGetBalance,
  waitForTransactionReceipt: mockWaitForTransactionReceipt,
  getTransactionReceipt: mockGetTransactionReceipt,
  chain: { id: 31337, name: 'Anvil' },
};

// Mock viem functions that need to be individually accessible
const mockRecoverMessageAddress = mock(async (..._args: any[]) => '0xabc123' as `0x${string}`);
const mockHashMessage = mock((..._args: any[]) => '0xhashed' as `0x${string}`);
const mockKeccak256 = mock((..._args: any[]) => ('0x' + '0'.repeat(64)) as `0x${string}`);
const mockToBytes = mock((_s: string) => new Uint8Array([1, 2, 3]));
const mockCreatePublicClient = mock(() => mockPublicClient);
const mockHttp = mock((url?: string) => ({ url }));
const mockDefineChain = mock((config: any) => config);

export function setupViemMock() {
  mock.module('viem', () => ({
    // Pure functions - use real implementations
    formatUnits: (value: bigint, decimals: number) => {
      const str = value.toString().padStart(decimals + 1, '0');
      const intPart = str.slice(0, -decimals) || '0';
      const decPart = str.slice(-decimals).replace(/0+$/, '');
      return decPart ? `${intPart}.${decPart}` : intPart;
    },
    parseUnits: (value: string, decimals: number) => {
      const cleaned = value.replace(/[,\s]/g, '');
      const [intPart, decPart = ''] = cleaned.split('.');
      const paddedDec = decPart.padEnd(decimals, '0').slice(0, decimals);
      return BigInt(intPart + paddedDec);
    },
    isAddress: (addr: string) => /^0x[0-9a-fA-F]{40}$/.test(addr),
    getAddress: (addr: string) => {
      if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) throw new Error(`Invalid address: ${addr}`);
      return addr;
    },
    checksumAddress: (addr: string) => addr,
    zeroAddress: '0x0000000000000000000000000000000000000000',
    parseEther: (value: string) => {
      const parts = value.split('.');
      const intPart = parts[0];
      const decPart = (parts[1] || '').padEnd(18, '0').slice(0, 18);
      return BigInt(intPart + decPart);
    },
    formatEther: (value: bigint) => {
      const str = value.toString().padStart(19, '0');
      const intPart = str.slice(0, -18) || '0';
      const decPart = str.slice(-18).replace(/0+$/, '');
      return decPart ? `${intPart}.${decPart}` : intPart;
    },
    pad: mock((hex: string, _opts?: any) => hex),
    keccak256: mockKeccak256,
    encodePacked: mock((..._args: any[]) => '0x00'),
    hexToBytes: mock((_hex: string) => new Uint8Array(0)),
    bytesToHex: mock((_bytes: Uint8Array) => '0x00'),

    // Network-dependent functions - mock
    createPublicClient: mockCreatePublicClient,
    http: mockHttp,
    createWalletClient: mock(() => ({})),
    defineChain: mockDefineChain,

    // Signature functions - mock
    recoverMessageAddress: mockRecoverMessageAddress,
    hashMessage: mockHashMessage,
    toBytes: mockToBytes,
  }));

  mock.module('viem/chains', () => ({
    baseSepolia: {
      id: 84532,
      name: 'Base Sepolia',
      rpcUrls: { default: { http: ['https://sepolia.base.org'] } },
    },
    base: {
      id: 8453,
      name: 'Base',
      rpcUrls: { default: { http: ['https://mainnet.base.org'] } },
    },
  }));

  return {
    mockPublicClient,
    mockReadContract,
    mockGetBlockNumber,
    mockGetBalance,
    mockWaitForTransactionReceipt,
    mockCreatePublicClient,
    mockHttp,
    mockDefineChain,
    mockRecoverMessageAddress,
    mockHashMessage,
    mockKeccak256,
    mockToBytes,
    setReadContractResult(val: any) {
      readContractResult = val;
      mockReadContract.mockImplementation(async () => val);
    },
    setBlockNumber(val: bigint) {
      blockNumberResult = val;
      mockGetBlockNumber.mockImplementation(async () => val);
    },
    setBalance(val: bigint) {
      balanceResult = val;
      mockGetBalance.mockImplementation(async () => val);
    },
    setTxReceipt(val: any) {
      txReceiptResult = val;
      mockWaitForTransactionReceipt.mockImplementation(async () => val);
      mockGetTransactionReceipt.mockImplementation(async () => val);
    },
    reset() {
      mockReadContract.mockClear();
      mockGetBlockNumber.mockClear();
      mockGetBalance.mockClear();
      mockWaitForTransactionReceipt.mockClear();
      mockGetTransactionReceipt.mockClear();
      mockCreatePublicClient.mockClear();
      mockRecoverMessageAddress.mockClear();
      mockHashMessage.mockClear();
      mockKeccak256.mockClear();
      mockToBytes.mockClear();
      readContractResult = 0n;
      blockNumberResult = 12345n;
      balanceResult = 1000000000000000000n;
      txReceiptResult = {
        blockNumber: 100n,
        status: 'success',
        gasUsed: 21000n,
        effectiveGasPrice: 1000000000n,
      };
    },
  };
}
