/**
 * Gas Tracking Utility for E2E Tests
 *
 * Tracks gas usage across all on-chain transactions during E2E tests
 * and generates a summary report at the end.
 */

import { formatEther } from 'viem';

export interface GasEntry {
  operation: string;
  gasUsed: bigint;
  gasPrice: bigint;
  costWei: bigint;
}

export interface GasReport {
  totalTransactions: number;
  totalGasUsed: bigint;
  totalCostWei: bigint;
  totalCostEth: string;
  byOperation: Record<string, { count: number; gasUsed: bigint; costWei: bigint }>;
}

class GasTracker {
  private entries: GasEntry[] = [];

  /**
   * Track gas usage for a transaction
   */
  track(operation: string, gasUsed: bigint, gasPrice: bigint): void {
    const costWei = gasUsed * gasPrice;
    this.entries.push({ operation, gasUsed, gasPrice, costWei });
  }

  /**
   * Get a structured report of gas usage
   */
  getReport(): GasReport {
    const byOperation: GasReport['byOperation'] = {};

    for (const entry of this.entries) {
      if (!byOperation[entry.operation]) {
        byOperation[entry.operation] = { count: 0, gasUsed: 0n, costWei: 0n };
      }
      byOperation[entry.operation].count++;
      byOperation[entry.operation].gasUsed += entry.gasUsed;
      byOperation[entry.operation].costWei += entry.costWei;
    }

    const totalGasUsed = this.entries.reduce((sum, e) => sum + e.gasUsed, 0n);
    const totalCostWei = this.entries.reduce((sum, e) => sum + e.costWei, 0n);

    return {
      totalTransactions: this.entries.length,
      totalGasUsed,
      totalCostWei,
      totalCostEth: formatEther(totalCostWei),
      byOperation,
    };
  }

  /**
   * Print a formatted gas report to console
   */
  printReport(): void {
    const report = this.getReport();

    if (report.totalTransactions === 0) {
      console.log('\n========== E2E Gas Report ==========');
      console.log('No transactions tracked.');
      console.log('====================================\n');
      return;
    }

    console.log('\n========== E2E Gas Report ==========');
    console.log(`Total Transactions: ${report.totalTransactions}`);
    console.log(`Total Gas Used: ${report.totalGasUsed.toLocaleString()}`);
    console.log(`Total Cost: ${report.totalCostEth} ETH`);
    console.log('\nBy Operation:');

    // Sort operations by gas used (descending)
    const sortedOps = Object.entries(report.byOperation).sort(
      ([, a], [, b]) => (b.gasUsed > a.gasUsed ? 1 : -1)
    );

    for (const [op, data] of sortedOps) {
      const avgGas = data.gasUsed / BigInt(data.count);
      console.log(
        `  ${op}: ${data.gasUsed.toLocaleString()} gas (${data.count} call${data.count > 1 ? 's' : ''}, avg: ${avgGas.toLocaleString()})`
      );
    }
    console.log('====================================\n');
  }

  /**
   * Reset all tracked entries
   */
  reset(): void {
    this.entries = [];
  }

  /**
   * Get all raw entries (useful for custom analysis)
   */
  getEntries(): readonly GasEntry[] {
    return this.entries;
  }
}

// Singleton instance for tracking across all tests
export const gasTracker = new GasTracker();
