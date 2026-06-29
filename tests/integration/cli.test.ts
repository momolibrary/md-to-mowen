import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { join } from 'path';

const CLI_PATH = join(__dirname, '../../dist/cli/index.js');

function runCli(args: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${args}`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return { stdout, exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; status?: number };
    return {
      stdout: execError.stdout || '',
      exitCode: execError.status || 1,
    };
  }
}

describe('CLI', () => {
  it('should show version', () => {
    const { stdout } = runCli('--version');
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should show help', () => {
    const { stdout } = runCli('--help');
    expect(stdout).toContain('md-to-mowen');
    expect(stdout).toContain('publish');
    expect(stdout).toContain('status');
    expect(stdout).toContain('privacy');
    expect(stdout).toContain('install-skill');
  });
});
