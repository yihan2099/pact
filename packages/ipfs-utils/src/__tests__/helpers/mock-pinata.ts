import { mock } from 'bun:test';

let uploadJsonResult: any = { cid: 'QmTestCid12345678901234567890123456789012', size: 1234 };
let signedUrlResult: string = 'https://gateway.pinata.cloud/ipfs/QmTest?token=signed';
let gatewayGetResult: any = { data: {} };

const mockUploadJson = mock(async (..._args: any[]) => uploadJsonResult);
const mockCreateSignedURL = mock(async (..._args: any[]) => signedUrlResult);
const mockGatewayGet = mock(async (..._args: any[]) => gatewayGetResult);

export function setupPinataMock() {
  mock.module('pinata', () => ({
    PinataSDK: class MockPinataSDK {
      upload = { json: mockUploadJson };
      gateways = { createSignedURL: mockCreateSignedURL, get: mockGatewayGet };
      constructor(_config: any) {}
    },
  }));

  return {
    mockUploadJson,
    mockCreateSignedURL,
    mockGatewayGet,
    setUploadResult(val: any) {
      uploadJsonResult = val;
      mockUploadJson.mockImplementation(async () => val);
    },
    setSignedUrl(val: string) {
      signedUrlResult = val;
      mockCreateSignedURL.mockImplementation(async () => val);
    },
    setGatewayGetResult(val: any) {
      gatewayGetResult = val;
      mockGatewayGet.mockImplementation(async () => val);
    },
    reset() {
      mockUploadJson.mockClear();
      mockCreateSignedURL.mockClear();
      mockGatewayGet.mockClear();
      uploadJsonResult = { cid: 'QmTestCid12345678901234567890123456789012', size: 1234 };
      signedUrlResult = 'https://gateway.pinata.cloud/ipfs/QmTest?token=signed';
      gatewayGetResult = { data: {} };
      mockUploadJson.mockImplementation(async () => uploadJsonResult);
      mockCreateSignedURL.mockImplementation(async () => signedUrlResult);
      mockGatewayGet.mockImplementation(async () => gatewayGetResult);
    },
  };
}
