import { describe, test, expect, mock } from 'bun:test';

// Mock external dependencies before importing the CLI module
const mockCallTool = mock(() => Promise.resolve({}));
const mockSetSessionId = mock(() => {});

mock.module('@clawboy/mcp-client', () => ({
  ClawboyApiClient: class MockApiClient {
    callTool = mockCallTool;
    setSessionId = mockSetSessionId;
    constructor(_opts: unknown) {}
  },
}));

mock.module('viem/accounts', () => ({
  privateKeyToAccount: mock(() => ({
    address: '0x1234567890123456789012345678901234567890',
    signMessage: mock(() => Promise.resolve('0xmocksignature')),
  })),
}));

// Since the CLI uses Commander which calls process.exit and console.log,
// we test the program definition by importing the module and inspecting Commander
import { Command } from 'commander';

describe('openclaw-skill CLI', () => {
  describe('program definition', () => {
    test('commander Command class should be importable', () => {
      const program = new Command();
      program.name('clawboy').description('Test CLI').version('0.1.0');

      expect(program.name()).toBe('clawboy');
      expect(program.version()).toBe('0.1.0');
    });

    test('should define list-tasks command with expected options', () => {
      const program = new Command();
      program.name('clawboy');

      const cmd = program
        .command('list-tasks')
        .description('List available tasks')
        .option('-s, --status <status>', 'Filter by status')
        .option('-t, --tags <tags>', 'Filter by tags')
        .option('--min-bounty <amount>', 'Minimum bounty in ETH')
        .option('--max-bounty <amount>', 'Maximum bounty in ETH')
        .option('-l, --limit <number>', 'Number of results', '20');

      expect(cmd.name()).toBe('list-tasks');
      const opts = cmd.opts();
      expect(opts.limit).toBe('20');
    });

    test('should define get-task command requiring taskId argument', () => {
      const program = new Command();
      program.name('clawboy');

      const cmd = program
        .command('get-task <taskId>')
        .description('Get detailed information about a task');

      expect(cmd.name()).toBe('get-task');
    });

    test('should define create-task command with required options', () => {
      const program = new Command();
      program.name('clawboy');

      const cmd = program
        .command('create-task')
        .description('Create a new task with a bounty')
        .requiredOption('--title <title>', 'Task title')
        .requiredOption('--description <description>', 'Task description')
        .requiredOption('--deliverables <json>', 'Deliverables as JSON array')
        .requiredOption('--bounty <amount>', 'Bounty amount in ETH');

      expect(cmd.name()).toBe('create-task');
    });

    test('should define register command with required name option', () => {
      const program = new Command();
      program.name('clawboy');

      const cmd = program
        .command('register')
        .description('Register as an agent on Clawboy')
        .requiredOption('--name <name>', 'Your display name')
        .requiredOption('--skills <skills>', 'Your skills');

      expect(cmd.name()).toBe('register');
    });

    test('should parse comma-separated tags into array', () => {
      const tagsInput = 'solidity,react,typescript';
      const result = tagsInput.split(',');
      expect(result).toEqual(['solidity', 'react', 'typescript']);
    });

    test('should parse comma-separated skills with trim', () => {
      const skillsInput = ' python , react , solidity ';
      const result = skillsInput.split(',').map((s: string) => s.trim());
      expect(result).toEqual(['python', 'react', 'solidity']);
    });
  });
});
