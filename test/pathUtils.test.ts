import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import { resolvePath, setValidRootDirectories } from '../src/utils/pathUtils.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

describe('resolvePath Utility', () => {
  const testProjectRoot = process.cwd();

  beforeEach(() => {
    // Reset to default behavior (no restrictions)
    setValidRootDirectories([]);
  });
  it('should resolve a valid relative path correctly', () => {
    const userPath = 'some/file.txt';
    const expectedPath = path.resolve(testProjectRoot, userPath);
    expect(resolvePath(userPath)).toBe(expectedPath);
  });

  it('should resolve paths with "." correctly', () => {
    const userPath = './some/./other/file.txt';
    const expectedPath = path.resolve(testProjectRoot, 'some/other/file.txt');
    expect(resolvePath(userPath)).toBe(expectedPath);
  });

  it('should resolve paths with ".." correctly within the project root', () => {
    const userPath = 'some/folder/../other/file.txt';
    const expectedPath = path.resolve(testProjectRoot, 'some/other/file.txt');
    expect(resolvePath(userPath)).toBe(expectedPath);
  });

  it('should throw McpError for path traversal attempts', () => {
    const userPath = '../outside/secret.txt';
    expect(() => resolvePath(userPath)).toThrow(McpError);
    expect(() => resolvePath(userPath)).toThrow('is not within any allowed directory');
    try {
      resolvePath(userPath);
    } catch (e) {
      expect(e).toBeInstanceOf(McpError);
      expect((e as McpError).code).toBe(ErrorCode.InvalidRequest);
    }
  });

  it('should throw McpError for path traversal attempts even if seemingly valid', () => {
    // Construct a path that uses '..' many times to try and escape
    const levelsUp = testProjectRoot.split(path.sep).filter(Boolean).length + 2; // Go up more levels than the root has
    const userPath = path.join(...(Array(levelsUp).fill('..') as string[]), 'secret.txt'); // Cast array to string[]
    expect(() => resolvePath(userPath)).toThrow(McpError);
    expect(() => resolvePath(userPath)).toThrow('is not within any allowed directory');
    try {
      resolvePath(userPath);
    } catch (e) {
      expect(e).toBeInstanceOf(McpError);
      expect((e as McpError).code).toBe(ErrorCode.InvalidRequest);
    }
  });

  it('should throw McpError for absolute paths', () => {
    const userPath = path.resolve(testProjectRoot, 'absolute/file.txt'); // An absolute path
    const userPathPosix = '/absolute/file.txt'; // POSIX style absolute path
    const userPathWin = 'C:\\absolute\\file.txt'; // Windows style absolute path

    expect(() => resolvePath(userPath)).toThrow(McpError);
    expect(() => resolvePath(userPath)).toThrow('Absolute paths are not allowed.');

    // Test specifically for POSIX and Windows style absolute paths if needed
    if (path.sep === '/') {
      // POSIX-like
      expect(() => resolvePath(userPathPosix)).toThrow(McpError);
      expect(() => resolvePath(userPathPosix)).toThrow('Absolute paths are not allowed.');
    } else {
      // Windows-like
      expect(() => resolvePath(userPathWin)).toThrow(McpError);
      expect(() => resolvePath(userPathWin)).toThrow('Absolute paths are not allowed.');
    }

    try {
      resolvePath(userPath);
    } catch (e) {
      expect(e).toBeInstanceOf(McpError);
      expect((e as McpError).code).toBe(ErrorCode.InvalidParams);
    }
  });

  it('should throw McpError for non-string input', () => {
    // Corrected line number for context
    const userPath = 123 as unknown as string; // Use unknown then cast to string for test
    expect(() => resolvePath(userPath)).toThrow(McpError);
    expect(() => resolvePath(userPath)).toThrow('Path must be a string.');
    try {
      resolvePath(userPath);
    } catch (e) {
      expect(e).toBeInstanceOf(McpError);
      expect((e as McpError).code).toBe(ErrorCode.InvalidParams);
    }
  });

  it('should handle empty string input', () => {
    const userPath = '';
    const expectedPath = path.resolve(testProjectRoot, ''); // Should resolve to the project root itself
    expect(resolvePath(userPath)).toBe(expectedPath);
  });

  it('should work with custom valid directories', () => {
    const customDir = '/tmp/test-pdfs';
    setValidRootDirectories([customDir]);

    const userPath = 'document.pdf';
    const expectedPath = path.resolve(customDir, userPath);
    expect(resolvePath(userPath)).toBe(expectedPath);

    // Should reject paths outside the custom directory
    expect(() => resolvePath('../outside.pdf')).toThrow(McpError);
  });

  it('should work with multiple valid directories', () => {
    const dir1 = '/tmp/pdfs1';
    const dir2 = '/tmp/pdfs2';
    setValidRootDirectories([dir1, dir2]);

    const userPath = 'doc.pdf';
    // Should resolve to the first matching directory
    const expectedPath = path.resolve(dir1, userPath);
    expect(resolvePath(userPath)).toBe(expectedPath);
  });
});
