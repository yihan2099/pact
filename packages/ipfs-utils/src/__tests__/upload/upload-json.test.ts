import { describe, test, expect, beforeEach } from 'bun:test';
import { setupPinataMock } from '../helpers/mock-pinata';

// Set env vars before importing source
process.env.PINATA_JWT = 'test-jwt-token';
process.env.PINATA_GATEWAY = 'https://test.mypinata.cloud';

// Setup mock BEFORE importing source
const pinataMock = setupPinataMock();

// Import real modules
const { resetPinataClient } = await import('../../client/pinata-client');
const {
  uploadJson,
  uploadTaskSpecification,
  uploadAgentProfile,
  uploadWorkSubmission,
  IpfsUploadError,
} = await import('../../upload/upload-json');

describe('upload-json', () => {
  beforeEach(() => {
    resetPinataClient();
    pinataMock.reset();
    process.env.PINATA_JWT = 'test-jwt-token';
    process.env.PINATA_GATEWAY = 'https://test.mypinata.cloud';
    delete process.env.PINATA_PUBLIC_GROUP_ID;
  });

  describe('uploadJson', () => {
    test('uploads JSON data and returns CID', async () => {
      pinataMock.setUploadResult({ cid: 'QmTestCid123', size: 256 });
      const result = await uploadJson({ key: 'value' });
      expect(result.cid).toBe('QmTestCid123');
      expect(result.size).toBe(256);
      expect(result.timestamp).toBeDefined();
    });

    test('passes metadata name', async () => {
      await uploadJson({ key: 'value' }, { name: 'my-file.json' });
      expect(pinataMock.mockUploadJson).toHaveBeenCalledWith(
        { key: 'value' },
        expect.objectContaining({
          metadata: expect.objectContaining({ name: 'my-file.json' }),
        })
      );
    });

    test('uses default name when not provided', async () => {
      await uploadJson({ key: 'value' });
      expect(pinataMock.mockUploadJson).toHaveBeenCalledWith(
        { key: 'value' },
        expect.objectContaining({
          metadata: expect.objectContaining({ name: 'clawboy-data.json' }),
        })
      );
    });

    test('passes keyvalues metadata', async () => {
      await uploadJson({ key: 'value' }, { keyvalues: { type: 'test' } });
      expect(pinataMock.mockUploadJson).toHaveBeenCalledWith(
        { key: 'value' },
        expect.objectContaining({
          metadata: expect.objectContaining({
            keyvalues: { type: 'test' },
          }),
        })
      );
    });

    test('includes groupId for public uploads', async () => {
      process.env.PINATA_PUBLIC_GROUP_ID = 'group-123';
      await uploadJson({ key: 'value' }, { isPublic: true });
      expect(pinataMock.mockUploadJson).toHaveBeenCalledWith(
        { key: 'value' },
        expect.objectContaining({ groupId: 'group-123' })
      );
    });

    test('does not include groupId for private uploads', async () => {
      await uploadJson({ key: 'value' }, { isPublic: false });
      expect(pinataMock.mockUploadJson).toHaveBeenCalledWith(
        { key: 'value' },
        expect.objectContaining({ groupId: undefined })
      );
    });

    test('throws IpfsUploadError on failure', async () => {
      pinataMock.mockUploadJson.mockRejectedValue(new Error('Upload failed'));
      await expect(uploadJson({ key: 'value' })).rejects.toThrow(IpfsUploadError);
    });

    test('retries on retryable errors', async () => {
      pinataMock.mockUploadJson
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValueOnce({ cid: 'QmRetried', size: 100 });

      const result = await uploadJson({ key: 'value' });
      expect(result.cid).toBe('QmRetried');
      expect(pinataMock.mockUploadJson).toHaveBeenCalledTimes(2);
    });

    test('retries on 500 server error', async () => {
      pinataMock.mockUploadJson
        .mockRejectedValueOnce(new Error('500 internal server error'))
        .mockResolvedValueOnce({ cid: 'QmOk', size: 50 });

      const result = await uploadJson({ key: 'value' });
      expect(result.cid).toBe('QmOk');
    });

    test('does not retry on non-retryable errors', async () => {
      pinataMock.mockUploadJson.mockRejectedValue(new Error('Invalid API key'));
      await expect(uploadJson({ key: 'value' })).rejects.toThrow();
      expect(pinataMock.mockUploadJson).toHaveBeenCalledTimes(1);
    });

    test('throws after max retries exhausted', async () => {
      pinataMock.mockUploadJson.mockRejectedValue(new Error('ECONNRESET'));
      await expect(uploadJson({ key: 'value' })).rejects.toThrow(IpfsUploadError);
      expect(pinataMock.mockUploadJson).toHaveBeenCalledTimes(3);
    });
  });

  describe('uploadTaskSpecification', () => {
    test('uploads as public content', async () => {
      process.env.PINATA_PUBLIC_GROUP_ID = 'pub-group';
      const spec = {
        version: '1.0',
        title: 'Test Task',
        description: 'A test',
        deliverables: [{ type: 'code', description: 'impl' }],
      };
      await uploadTaskSpecification(spec as any);
      expect(pinataMock.mockUploadJson).toHaveBeenCalledWith(
        spec,
        expect.objectContaining({
          groupId: 'pub-group',
        })
      );
    });

    test('sets metadata type to task-specification', async () => {
      const spec = {
        version: '1.0',
        title: 'Test',
        description: 'Test',
        deliverables: [],
      };
      await uploadTaskSpecification(spec as any);
      expect(pinataMock.mockUploadJson).toHaveBeenCalledWith(
        spec,
        expect.objectContaining({
          metadata: expect.objectContaining({
            keyvalues: expect.objectContaining({ type: 'task-specification' }),
          }),
        })
      );
    });
  });

  describe('uploadAgentProfile', () => {
    test('uploads as public content', async () => {
      process.env.PINATA_PUBLIC_GROUP_ID = 'pub-group';
      const profile = { version: '1.0', name: 'Agent', skills: ['solidity'] };
      await uploadAgentProfile(profile as any);
      expect(pinataMock.mockUploadJson).toHaveBeenCalledWith(
        profile,
        expect.objectContaining({ groupId: 'pub-group' })
      );
    });
  });

  describe('uploadWorkSubmission', () => {
    test('uploads as private content (no groupId)', async () => {
      const submission = {
        version: '1.0',
        taskId: 'task-1',
        summary: 'My work',
        deliverables: [],
      };
      await uploadWorkSubmission(submission as any);
      expect(pinataMock.mockUploadJson).toHaveBeenCalledWith(
        submission,
        expect.objectContaining({ groupId: undefined })
      );
    });

    test('includes taskId in keyvalues', async () => {
      const submission = {
        version: '1.0',
        taskId: 'task-42',
        summary: 'Work',
        deliverables: [],
      };
      await uploadWorkSubmission(submission as any);
      expect(pinataMock.mockUploadJson).toHaveBeenCalledWith(
        submission,
        expect.objectContaining({
          metadata: expect.objectContaining({
            keyvalues: expect.objectContaining({ taskId: 'task-42' }),
          }),
        })
      );
    });
  });

  describe('IpfsUploadError', () => {
    test('has correct name', () => {
      const err = new IpfsUploadError('test');
      expect(err.name).toBe('IpfsUploadError');
    });

    test('stores cause', () => {
      const cause = new Error('original');
      const err = new IpfsUploadError('wrapped', cause);
      expect(err.cause).toBe(cause);
    });
  });
});
