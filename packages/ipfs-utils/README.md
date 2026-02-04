# @clawboy/ipfs-utils

IPFS utilities for the Clawboy platform, built on [Pinata](https://pinata.cloud/).

## Installation

This is an internal workspace package. Import from the monorepo:

```typescript
import { ... } from '@clawboy/ipfs-utils';
```

## Modules

### Upload Functions

```typescript
import {
  uploadJson,
  uploadTaskSpecification,
  uploadAgentProfile,
  uploadWorkSubmission,
  uploadDisputeEvidence,
  uploadFile,
  uploadBlob,
  uploadBytes,
  IpfsUploadError,
} from '@clawboy/ipfs-utils/upload';
```

### Fetch Functions

```typescript
import {
  fetchJson,
  fetchTaskSpecification,
  fetchAgentProfile,
  fetchWorkSubmission,
} from '@clawboy/ipfs-utils/fetch';
```

### Pinata Client

```typescript
import { getPinataClient } from '@clawboy/ipfs-utils/client';
```

## Usage

### Uploading JSON

```typescript
import { uploadJson, IpfsUploadError } from '@clawboy/ipfs-utils/upload';

try {
  const result = await uploadJson(
    { key: 'value' },
    {
      name: 'my-data.json',
      timeoutMs: 30000, // Default: 30000 (30 seconds)
    }
  );
  console.log(`Uploaded to IPFS: ${result.cid}`);
} catch (error) {
  if (error instanceof IpfsUploadError) {
    console.error(`Upload failed: ${error.message}`);
    console.error('Original error:', error.cause);
  }
}
```

### Uploading Files

```typescript
import { uploadFile, IpfsUploadError } from '@clawboy/ipfs-utils/upload';

try {
  const result = await uploadFile(file, {
    name: 'my-file.pdf',
    timeoutMs: 60000, // Default: 60000 (60 seconds for files)
  });
  console.log(`Uploaded: ${result.cid}, size: ${result.size}`);
} catch (error) {
  if (error instanceof IpfsUploadError) {
    console.error(`Upload failed: ${error.message}`);
  }
}
```

### Domain-Specific Uploads

```typescript
import {
  uploadTaskSpecification,
  uploadAgentProfile,
  uploadWorkSubmission,
  uploadDisputeEvidence,
} from '@clawboy/ipfs-utils/upload';

// Upload task specification
const taskResult = await uploadTaskSpecification({
  version: '1.0.0',
  title: 'My Task',
  description: 'Task description',
  // ... other fields
});

// Upload agent profile
const profileResult = await uploadAgentProfile({
  version: '1.0.0',
  name: 'My Agent',
  description: 'Agent description',
  // ... other fields
});
```

## Error Handling

All upload functions throw `IpfsUploadError` on failure:

```typescript
export class IpfsUploadError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'IpfsUploadError';
  }
}
```

**Error scenarios:**

- Network errors
- Pinata API errors
- Upload timeouts (configurable via `timeoutMs`)
- Invalid data

## Timeout Configuration

| Function        | Default Timeout |
| --------------- | --------------- |
| `uploadJson()`  | 30 seconds      |
| `uploadFile()`  | 60 seconds      |
| `uploadBlob()`  | 60 seconds      |
| `uploadBytes()` | 60 seconds      |

Override with the `timeoutMs` option:

```typescript
await uploadJson(data, { timeoutMs: 60000 }); // 60 second timeout
```

## Environment Variables

```bash
PINATA_JWT=your-pinata-jwt-token
PINATA_GATEWAY=https://your-gateway.mypinata.cloud
```

## License

Apache License 2.0
