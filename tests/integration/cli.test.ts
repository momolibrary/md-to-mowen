import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { join } from 'path';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';

const CLI_PATH = join(__dirname, '../../dist/cli.js');

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
    expect(stdout.trim()).toBe('1.0.0');
  });

  it('should show help', () => {
    const { stdout } = runCli('--help');
    expect(stdout).toContain('md-to-mowen');
    expect(stdout).toContain('publish');
    expect(stdout).toContain('lint');
    expect(stdout).toContain('upload');
  });

  it('should run lint on valid file', () => {
    // Create temp file
    const tempDir = join(tmpdir(), 'mowen-test');
    mkdirSync(tempDir, { recursive: true });
    const tempFile = join(tempDir, 'test.md');

    writeFileSync(
      tempFile,
      `# 测试文章

这是一篇测试文章，包含足够的字数来通过长度检查。我们需要写更多的内容来确保文章长度能够满足要求。

![image](test.png)

## 第二部分

这里是第二部分的内容。我们继续添加更多的文字来确保整篇文章的长度能够达到最低要求。这样可以避免长度检查失败。

### 第三部分

继续添加内容。这是一段额外的文字，用来填充文章长度。我们需要确保总字数超过一百个字符。`
    );

    try {
      const { stdout } = runCli(`lint ${tempFile}`);
      expect(stdout).toContain('配图检查通过');
      expect(stdout).toContain('文章长度检查通过');
    } finally {
      try {
        unlinkSync(tempFile);
      } catch {
        // Ignore if file doesn't exist
      }
    }
  });

  it('should fail lint on short file', () => {
    // Create temp file
    const tempDir = join(tmpdir(), 'mowen-test');
    mkdirSync(tempDir, { recursive: true });
    const tempFile = join(tempDir, 'test-short.md');

    writeFileSync(tempFile, '# 短文章\n\n太短了。');

    try {
      const { exitCode } = runCli(`lint ${tempFile} --min-chars 100`);
      expect(exitCode).toBe(1);
    } finally {
      try {
        unlinkSync(tempFile);
      } catch {
        // Ignore if file doesn't exist
      }
    }
  });
});
