import { describe, test, expect } from 'bun:test';

import {
  // Task status exports
  TaskStatus,
  TaskStatusNumber,
  TERMINAL_STATUSES,
  VALID_STATUS_TRANSITIONS,
  numberToTaskStatus,
  isValidStatusTransition,
  isTerminalStatus,
  stringToTaskStatus,
  InvalidStatusTransitionError,
  assertValidStatusTransition,
  getStatusDescription,

  // Dispute exports
  DisputeStatus,
  DisputeStatusNumber,
  calculateDisputeStake,

  // Address utility exports
  normalizeAddress,
  normalizeEthAddress,
  addressesEqual,
  isValidAddress,
  validateAndNormalizeAddress,
  truncateAddress,
  ZERO_ADDRESS,
  isZeroAddress,
} from '../index.js';

describe('TaskStatus enum', () => {
  test('should define all expected status values', () => {
    expect(TaskStatus.Open).toBe('open');
    expect(TaskStatus.InReview).toBe('in_review');
    expect(TaskStatus.Completed).toBe('completed');
    expect(TaskStatus.Disputed).toBe('disputed');
    expect(TaskStatus.Refunded).toBe('refunded');
    expect(TaskStatus.Cancelled).toBe('cancelled');
  });

  test('should have exactly 6 statuses', () => {
    const values = Object.values(TaskStatus);
    expect(values).toHaveLength(6);
  });
});

describe('TaskStatusNumber', () => {
  test('should map each status to a unique number', () => {
    expect(TaskStatusNumber[TaskStatus.Open]).toBe(0);
    expect(TaskStatusNumber[TaskStatus.InReview]).toBe(1);
    expect(TaskStatusNumber[TaskStatus.Completed]).toBe(2);
    expect(TaskStatusNumber[TaskStatus.Disputed]).toBe(3);
    expect(TaskStatusNumber[TaskStatus.Refunded]).toBe(4);
    expect(TaskStatusNumber[TaskStatus.Cancelled]).toBe(5);
  });
});

describe('TERMINAL_STATUSES', () => {
  test('should include completed, refunded, and cancelled', () => {
    expect(TERMINAL_STATUSES).toContain(TaskStatus.Completed);
    expect(TERMINAL_STATUSES).toContain(TaskStatus.Refunded);
    expect(TERMINAL_STATUSES).toContain(TaskStatus.Cancelled);
  });

  test('should not include non-terminal statuses', () => {
    expect(TERMINAL_STATUSES).not.toContain(TaskStatus.Open);
    expect(TERMINAL_STATUSES).not.toContain(TaskStatus.InReview);
    expect(TERMINAL_STATUSES).not.toContain(TaskStatus.Disputed);
  });
});

describe('numberToTaskStatus', () => {
  test('should convert valid numbers to TaskStatus', () => {
    expect(numberToTaskStatus(0)).toBe(TaskStatus.Open);
    expect(numberToTaskStatus(1)).toBe(TaskStatus.InReview);
    expect(numberToTaskStatus(2)).toBe(TaskStatus.Completed);
    expect(numberToTaskStatus(3)).toBe(TaskStatus.Disputed);
    expect(numberToTaskStatus(4)).toBe(TaskStatus.Refunded);
    expect(numberToTaskStatus(5)).toBe(TaskStatus.Cancelled);
  });

  test('should throw for unknown status number', () => {
    expect(() => numberToTaskStatus(99)).toThrow('Unknown task status number: 99');
  });
});

describe('stringToTaskStatus', () => {
  test('should convert valid strings to TaskStatus', () => {
    expect(stringToTaskStatus('open')).toBe(TaskStatus.Open);
    expect(stringToTaskStatus('in_review')).toBe(TaskStatus.InReview);
    expect(stringToTaskStatus('completed')).toBe(TaskStatus.Completed);
    expect(stringToTaskStatus('disputed')).toBe(TaskStatus.Disputed);
    expect(stringToTaskStatus('refunded')).toBe(TaskStatus.Refunded);
    expect(stringToTaskStatus('cancelled')).toBe(TaskStatus.Cancelled);
  });

  test('should throw for unknown status string', () => {
    expect(() => stringToTaskStatus('invalid')).toThrow('Unknown task status: invalid');
  });
});

describe('isValidStatusTransition', () => {
  test('should allow valid transitions from open', () => {
    expect(isValidStatusTransition(TaskStatus.Open, TaskStatus.InReview)).toBe(true);
    expect(isValidStatusTransition(TaskStatus.Open, TaskStatus.Cancelled)).toBe(true);
    expect(isValidStatusTransition(TaskStatus.Open, TaskStatus.Refunded)).toBe(true);
  });

  test('should reject invalid transitions from open', () => {
    expect(isValidStatusTransition(TaskStatus.Open, TaskStatus.Completed)).toBe(false);
    expect(isValidStatusTransition(TaskStatus.Open, TaskStatus.Disputed)).toBe(false);
  });

  test('should allow valid transitions from in_review', () => {
    expect(isValidStatusTransition(TaskStatus.InReview, TaskStatus.Completed)).toBe(true);
    expect(isValidStatusTransition(TaskStatus.InReview, TaskStatus.Disputed)).toBe(true);
  });

  test('should reject all transitions from terminal statuses', () => {
    expect(isValidStatusTransition(TaskStatus.Completed, TaskStatus.Open)).toBe(false);
    expect(isValidStatusTransition(TaskStatus.Refunded, TaskStatus.Open)).toBe(false);
    expect(isValidStatusTransition(TaskStatus.Cancelled, TaskStatus.Open)).toBe(false);
  });

  test('should accept string status arguments', () => {
    expect(isValidStatusTransition('open', 'in_review')).toBe(true);
    expect(isValidStatusTransition('open', 'completed')).toBe(false);
  });

  test('should allow valid transitions from disputed', () => {
    expect(isValidStatusTransition(TaskStatus.Disputed, TaskStatus.Completed)).toBe(true);
    expect(isValidStatusTransition(TaskStatus.Disputed, TaskStatus.Refunded)).toBe(true);
  });
});

describe('VALID_STATUS_TRANSITIONS', () => {
  test('should define transitions for all statuses', () => {
    const statuses = Object.values(TaskStatus);
    for (const status of statuses) {
      expect(VALID_STATUS_TRANSITIONS[status]).toBeDefined();
      expect(Array.isArray(VALID_STATUS_TRANSITIONS[status])).toBe(true);
    }
  });
});

describe('isTerminalStatus', () => {
  test('should return true for terminal statuses', () => {
    expect(isTerminalStatus(TaskStatus.Completed)).toBe(true);
    expect(isTerminalStatus(TaskStatus.Refunded)).toBe(true);
    expect(isTerminalStatus(TaskStatus.Cancelled)).toBe(true);
  });

  test('should return false for non-terminal statuses', () => {
    expect(isTerminalStatus(TaskStatus.Open)).toBe(false);
    expect(isTerminalStatus(TaskStatus.InReview)).toBe(false);
    expect(isTerminalStatus(TaskStatus.Disputed)).toBe(false);
  });

  test('should accept string arguments', () => {
    expect(isTerminalStatus('completed')).toBe(true);
    expect(isTerminalStatus('open')).toBe(false);
  });
});

describe('InvalidStatusTransitionError', () => {
  test('should construct with correct error message', () => {
    const error = new InvalidStatusTransitionError(TaskStatus.Open, TaskStatus.Completed);

    expect(error.name).toBe('InvalidStatusTransitionError');
    expect(error.message).toContain("Invalid status transition from 'open' to 'completed'");
    expect(error.message).toContain("Valid transitions from 'open'");
    expect(error.fromStatus).toBe(TaskStatus.Open);
    expect(error.toStatus).toBe(TaskStatus.Completed);
  });

  test('should include taskId in message when provided', () => {
    const error = new InvalidStatusTransitionError(
      TaskStatus.Open,
      TaskStatus.Completed,
      'task-42'
    );

    expect(error.message).toContain('(task: task-42)');
  });

  test('should show "none (terminal state)" for terminal status transitions', () => {
    const error = new InvalidStatusTransitionError(TaskStatus.Completed, TaskStatus.Open);

    expect(error.message).toContain('none (terminal state)');
  });
});

describe('assertValidStatusTransition', () => {
  test('should not throw for valid transitions', () => {
    expect(() => assertValidStatusTransition(TaskStatus.Open, TaskStatus.InReview)).not.toThrow();
  });

  test('should throw InvalidStatusTransitionError for invalid transitions', () => {
    expect(() =>
      assertValidStatusTransition(TaskStatus.Open, TaskStatus.Completed, 'task-1')
    ).toThrow(InvalidStatusTransitionError);
  });
});

describe('getStatusDescription', () => {
  test('should return descriptions for all statuses', () => {
    expect(getStatusDescription(TaskStatus.Open)).toContain('accepting submissions');
    expect(getStatusDescription(TaskStatus.InReview)).toContain('challenge period');
    expect(getStatusDescription(TaskStatus.Completed)).toContain('successfully');
    expect(getStatusDescription(TaskStatus.Disputed)).toContain('dispute');
    expect(getStatusDescription(TaskStatus.Refunded)).toContain('returned');
    expect(getStatusDescription(TaskStatus.Cancelled)).toContain('cancelled');
  });

  test('should accept string arguments', () => {
    expect(getStatusDescription('open')).toContain('accepting submissions');
  });
});

describe('DisputeStatus enum', () => {
  test('should define all expected status values', () => {
    expect(DisputeStatus.Active).toBe('active');
    expect(DisputeStatus.Resolved).toBe('resolved');
    expect(DisputeStatus.Cancelled).toBe('cancelled');
  });
});

describe('DisputeStatusNumber', () => {
  test('should map each status to correct number', () => {
    expect(DisputeStatusNumber[DisputeStatus.Active]).toBe(0);
    expect(DisputeStatusNumber[DisputeStatus.Resolved]).toBe(1);
    expect(DisputeStatusNumber[DisputeStatus.Cancelled]).toBe(2);
  });
});

describe('calculateDisputeStake', () => {
  test('should return 1% of bounty when above minimum', () => {
    const bounty = BigInt('2000000000000000000'); // 2 ETH
    const stake = calculateDisputeStake(bounty);
    expect(stake).toBe(BigInt('20000000000000000')); // 0.02 ETH
  });

  test('should return minimum stake when 1% is below minimum', () => {
    const bounty = BigInt('100000000000000000'); // 0.1 ETH
    const stake = calculateDisputeStake(bounty);
    // 1% of 0.1 ETH = 0.001 ETH < 0.01 ETH minimum
    expect(stake).toBe(BigInt('10000000000000000')); // 0.01 ETH
  });

  test('should return minimum for zero bounty', () => {
    const stake = calculateDisputeStake(BigInt(0));
    expect(stake).toBe(BigInt('10000000000000000')); // 0.01 ETH
  });

  test('should return exact minimum when 1% equals minimum', () => {
    const bounty = BigInt('1000000000000000000'); // 1 ETH
    const stake = calculateDisputeStake(bounty);
    // 1% of 1 ETH = 0.01 ETH = minimum
    expect(stake).toBe(BigInt('10000000000000000')); // 0.01 ETH
  });
});

describe('Address utilities', () => {
  describe('normalizeAddress', () => {
    test('should lowercase an address', () => {
      expect(normalizeAddress('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')).toBe(
        '0xabcdef1234567890abcdef1234567890abcdef12'
      );
    });

    test('should leave lowercase address unchanged', () => {
      expect(normalizeAddress('0xabcdef')).toBe('0xabcdef');
    });
  });

  describe('normalizeEthAddress', () => {
    test('should return a typed EthAddress', () => {
      const result = normalizeEthAddress('0xABCDEF1234567890ABCDEF1234567890ABCDEF12');
      expect(result).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
      // Type check: result should be assignable to `0x${string}`
      const _typeCheck: `0x${string}` = result;
      expect(_typeCheck).toBeDefined();
    });
  });

  describe('addressesEqual', () => {
    test('should return true for same address different case', () => {
      expect(
        addressesEqual(
          '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
          '0xabcdef1234567890abcdef1234567890abcdef12'
        )
      ).toBe(true);
    });

    test('should return false for different addresses', () => {
      expect(
        addressesEqual(
          '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
          '0x1234567890ABCDEF1234567890ABCDEF12345678'
        )
      ).toBe(false);
    });
  });

  describe('isValidAddress', () => {
    test('should return true for valid 40-hex address', () => {
      expect(isValidAddress('0x1234567890123456789012345678901234567890')).toBe(true);
    });

    test('should return false for short address', () => {
      expect(isValidAddress('0x1234')).toBe(false);
    });

    test('should return false for non-hex characters', () => {
      expect(isValidAddress('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')).toBe(false);
    });

    test('should return false for missing 0x prefix', () => {
      expect(isValidAddress('1234567890123456789012345678901234567890')).toBe(false);
    });
  });

  describe('validateAndNormalizeAddress', () => {
    test('should return normalized address for valid input', () => {
      const result = validateAndNormalizeAddress('0xABCDEF1234567890ABCDEF1234567890ABCDEF12');
      expect(result).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
    });

    test('should throw for invalid address', () => {
      expect(() => validateAndNormalizeAddress('not-an-address')).toThrow(
        'Invalid Ethereum address: not-an-address'
      );
    });
  });

  describe('truncateAddress', () => {
    test('should truncate with default params', () => {
      const result = truncateAddress('0x1234567890123456789012345678901234567890');
      expect(result).toBe('0x1234...7890');
    });

    test('should truncate with custom start and end chars', () => {
      const result = truncateAddress('0x1234567890123456789012345678901234567890', 10, 6);
      expect(result).toBe('0x12345678...567890');
    });

    test('should return full address if shorter than truncation bounds', () => {
      const result = truncateAddress('0x1234', 6, 4);
      expect(result).toBe('0x1234');
    });
  });

  describe('ZERO_ADDRESS', () => {
    test('should be the 40-zero hex address', () => {
      expect(ZERO_ADDRESS).toBe('0x0000000000000000000000000000000000000000');
    });
  });

  describe('isZeroAddress', () => {
    test('should return true for zero address', () => {
      expect(isZeroAddress('0x0000000000000000000000000000000000000000')).toBe(true);
    });

    test('should return true for zero address with mixed case', () => {
      expect(isZeroAddress('0x0000000000000000000000000000000000000000')).toBe(true);
    });

    test('should return false for non-zero address', () => {
      expect(isZeroAddress('0x1234567890123456789012345678901234567890')).toBe(false);
    });
  });
});

describe('Module exports completeness', () => {
  test('should export TaskStatus enum', () => {
    expect(TaskStatus).toBeDefined();
  });

  test('should export DisputeStatus enum', () => {
    expect(DisputeStatus).toBeDefined();
  });

  test('should export all task status utility functions', () => {
    expect(typeof numberToTaskStatus).toBe('function');
    expect(typeof isValidStatusTransition).toBe('function');
    expect(typeof isTerminalStatus).toBe('function');
    expect(typeof stringToTaskStatus).toBe('function');
    expect(typeof assertValidStatusTransition).toBe('function');
    expect(typeof getStatusDescription).toBe('function');
  });

  test('should export all address utility functions', () => {
    expect(typeof normalizeAddress).toBe('function');
    expect(typeof normalizeEthAddress).toBe('function');
    expect(typeof addressesEqual).toBe('function');
    expect(typeof isValidAddress).toBe('function');
    expect(typeof validateAndNormalizeAddress).toBe('function');
    expect(typeof truncateAddress).toBe('function');
    expect(typeof isZeroAddress).toBe('function');
  });

  test('should export dispute utility functions', () => {
    expect(typeof calculateDisputeStake).toBe('function');
  });

  test('should export constants', () => {
    expect(TaskStatusNumber).toBeDefined();
    expect(TERMINAL_STATUSES).toBeDefined();
    expect(VALID_STATUS_TRANSITIONS).toBeDefined();
    expect(DisputeStatusNumber).toBeDefined();
    expect(ZERO_ADDRESS).toBeDefined();
  });
});
