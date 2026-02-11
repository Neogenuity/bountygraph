# BountyGraph API Utilities

This document describes the utility functions, validation helpers, and error handling mechanisms available in the BountyGraph API.

## Overview

The `api/src/utils.ts` module provides:

- **Validation Functions**: Validate Solana keys, hashes, and request payloads
- **Error Handling**: Standardized error types and response formatting
- **Response Helpers**: Consistent success/error response patterns
- **Webhook Utilities**: Parse Helius events for BountyGraph
- **Helper Functions**: Generate IDs, calculate payouts, timestamps

## Usage Examples

### Validating Requests

```typescript
import { validateBountyRequest, sendValidationError } from './utils';

app.post('/bounties', (req, res) => {
  const error = validateBountyRequest(req.body);
  if (error) {
    return sendValidationError(res, error);
  }
  // Process request...
});
```

### Using Error Handling

```typescript
import { ApiError, ErrorCode, sendError } from './utils';

try {
  // Some operation
} catch (error) {
  const apiError = new ApiError(
    ErrorCode.TRANSACTION_FAILED,
    500,
    'Failed to verify receipt',
    { transactionHash: 'abc123' }
  );
  return sendError(res, apiError);
}
```

### Validating Solana Keys

```typescript
import { isValidSolanaKey } from './utils';

if (!isValidSolanaKey(userWallet)) {
  return res.status(400).json({ error: 'Invalid Solana wallet address' });
}
```

### Calculating Payouts

```typescript
import { calculateMilestonePayout } from './utils';

const bountyAmount = 10000;
const milestoneCount = 5;
const payoutPerMilestone = calculateMilestonePayout(bountyAmount, milestoneCount);
// Returns 2000
```

### Generating Unique IDs

```typescript
import { generateReceiptId, generateBountyId } from './utils';

const bountyId = generateBountyId(creatorWallet);
const receiptId = generateReceiptId(bountyId, milestoneIndex);
```

## Validation Functions

### `isValidSolanaKey(key: string): boolean`

Validates that a string is a valid Solana public key (44 base58 characters).

**Example:**
```typescript
isValidSolanaKey('BGRPHFnG8z7gxJnefVh3Y7LV9TjTuN2hfQdqzN9vNS5A') // true
isValidSolanaKey('invalid') // false
```

### `isValidHash(hash: string): boolean`

Validates that a string is a valid SHA-256 hash (64 hex or 44 base64 characters).

**Example:**
```typescript
isValidHash('a'.repeat(64)) // true (hex)
isValidHash('a'.repeat(43) + '=') // true (base64)
isValidHash('invalid') // false
```

### `validateBountyRequest(data: any): string | null`

Validates bounty creation request parameters.

**Required Fields:**
- `bountyId` (string)
- `title` (string)
- `totalAmount` (number > 0)
- `milestoneCount` (integer, 1-10)

**Optional Fields:**
- `creatorWallet` (valid Solana key)
- `description` (string)

**Example:**
```typescript
const error = validateBountyRequest({
  bountyId: 'bounty-123',
  title: 'My Task',
  totalAmount: 1000,
  milestoneCount: 3
});
// Returns null (valid) or error message (invalid)
```

### `validateReceiptRequest(data: any): string | null`

Validates receipt submission request parameters.

**Required Fields:**
- `receiptId` (string)
- `bountyId` (string)
- `milestoneIndex` (non-negative integer)

**Optional Fields:**
- `artifactHash` (valid SHA-256 hash)
- `metadataUri` (string)
- `workerWallet` (valid Solana key)

### `validateDependencyRequest(data: any): string | null`

Validates dependency edge creation request.

**Required Fields:**
- `edgeId` (string)
- `sourceReceiptId` (string)
- `targetReceiptId` (string, must differ from source)

### `validateVerificationRequest(data: any): string | null`

Validates receipt verification request.

**Required Fields:**
- `approved` (boolean)

**Optional Fields:**
- `verifierNote` (string)

## Response Functions

### `sendSuccess(res, data, statusCode?): void`

Send a standardized success response.

**Example:**
```typescript
sendSuccess(res, { bountyId: 'bounty-123' }, 201);
// Response: { "success": true, "data": { "bountyId": "bounty-123" } }
```

### `sendValidationError(res, message): void`

Send a validation error response (400).

**Example:**
```typescript
sendValidationError(res, 'bountyId is required');
// Response: { "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

### `sendError(res, error): void`

Send an error response with appropriate status code.

**Example:**
```typescript
const error = new ApiError(ErrorCode.NOT_FOUND, 404, 'Bounty not found');
sendError(res, error);
```

## Error Types

```typescript
enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INVALID_SOLANA_KEY = 'INVALID_SOLANA_KEY',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
}
```

## Webhook Utilities

### `parseHeliusEvent(event: any): { type: string; bountyId?: string } | null`

Parse Helius webhook events for BountyGraph transaction types.

**Supported Events:**
- `RECEIPT_SUBMITTED`: Receipt milestone submission
- `RECEIPT_VERIFIED`: Receipt verification and payout
- `BOUNTY_CREATED`: New bounty creation
- `DEPENDENCY_CREATED`: Dependency edge creation

**Example:**
```typescript
app.post('/webhooks/helius', (req, res) => {
  const parsedEvent = parseHeliusEvent(req.body);
  if (parsedEvent?.type === 'RECEIPT_VERIFIED') {
    // Handle receipt verification event
  }
  res.json({ ok: true });
});
```

## Helper Functions

### `calculateMilestonePayout(totalAmount, milestoneCount, currentMilestone?): number`

Calculate the payout amount for a single milestone.

Currently uses equal distribution across milestones. Can be enhanced with weighted distribution.

**Example:**
```typescript
calculateMilestonePayout(1000, 5) // 200 per milestone
calculateMilestonePayout(1000, 3) // 333 per milestone (floor division)
```

### `generateReceiptId(bountyId, milestoneIndex): string`

Generate a unique receipt ID based on bounty and milestone context.

**Example:**
```typescript
generateReceiptId('bounty-123', 0) // 'receipt-bounty-123-0-1707513940123'
```

### `generateBountyId(creatorWallet): string`

Generate a unique bounty ID based on creator and timestamp.

**Example:**
```typescript
generateBountyId('BGRPHFnG8z7gxJnefVh3Y7LV9TjTuN2hfQdqzN9vNS5A')
// 'bounty-BGRPHFnG-1707513940123-abcdef'
```

### `getCurrentTimestamp(): number`

Get current Unix timestamp (seconds since epoch).

**Example:**
```typescript
getCurrentTimestamp() // 1707513940
```

### `formatErrorLog(error, context): string`

Format an error for structured logging.

**Example:**
```typescript
const error = new ApiError(ErrorCode.NOT_FOUND, 404, 'Receipt not found');
console.error(formatErrorLog(error, 'GET /receipts/:id'));
// Output: '[GET /receipts/:id] NOT_FOUND: Receipt not found'
```

## Testing

Comprehensive test suite included in `api/tests/utils.test.ts`.

**Run tests:**
```bash
npm run test
```

**Test coverage includes:**
- ✅ Solana key validation (valid/invalid formats)
- ✅ SHA-256 hash validation (hex and base64)
- ✅ Bounty request validation
- ✅ Receipt request validation
- ✅ Dependency validation
- ✅ Verification validation
- ✅ Payout calculations
- ✅ ID generation
- ✅ Error handling
- ✅ Timestamp utilities

## Integration with API Endpoints

Recommended pattern for all API endpoints:

```typescript
app.post('/bounties', async (req, res) => {
  try {
    // 1. Validate request
    const validationError = validateBountyRequest(req.body);
    if (validationError) {
      return sendValidationError(res, validationError);
    }

    // 2. Validate Solana key
    if (!isValidSolanaKey(req.body.creatorWallet)) {
      return sendValidationError(res, 'Invalid creator wallet');
    }

    // 3. Process request
    const bountyId = generateBountyId(req.body.creatorWallet);
    const payout = calculateMilestonePayout(
      req.body.totalAmount,
      req.body.milestoneCount
    );

    // 4. Return success response
    return sendSuccess(res, { bountyId, payoutPerMilestone: payout }, 201);
  } catch (error) {
    console.error(formatErrorLog(error, 'POST /bounties'));
    return sendError(res, error);
  }
});
```

## Future Enhancements

- [ ] Add rate limiting utilities
- [ ] Add request signing/verification for Solana transactions
- [ ] Add database query validation
- [ ] Add Helius event filtering
- [ ] Add metrics/instrumentation helpers
- [ ] Add retry utilities for failed transactions
- [ ] Add caching helpers
- [ ] Add pagination utilities

## Contributing

When adding new API endpoints:

1. Create request validation function if needed
2. Use `sendSuccess` and `sendError` for responses
3. Use `ApiError` for business logic errors
4. Add tests to `api/tests/utils.test.ts`
5. Document new utilities in this file

## License

MIT
