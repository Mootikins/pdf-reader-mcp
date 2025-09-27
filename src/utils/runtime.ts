/**
 * Runtime compatibility layer for Node.js, Bun, and Deno
 */

export interface RuntimeInfo {
  name: 'node' | 'bun' | 'deno';
  version: string;
  supportsNodeFS: boolean;
  supportsNodePath: boolean;
  supportsProcess: boolean;
}

/**
 * Detect the current JavaScript runtime
 */
export function detectRuntime(): RuntimeInfo {
  // Check for Bun
  if (typeof Bun !== 'undefined' && 'version' in Bun) {
    return {
      name: 'bun',
      version: (Bun as { version: string }).version,
      supportsNodeFS: true,
      supportsNodePath: true,
      supportsProcess: true,
    };
  }

  // Check for Deno
  if (typeof Deno !== 'undefined' && 'version' in Deno) {
    return {
      name: 'deno',
      version: (Deno as { version: { deno: string } }).version.deno,
      supportsNodeFS: false,
      supportsNodePath: false,
      supportsProcess: false,
    };
  }

  // Default to Node.js
  return {
    name: 'node',
    version: process.version,
    supportsNodeFS: true,
    supportsNodePath: true,
    supportsProcess: true,
  };
}

/**
 * Get current working directory in a runtime-agnostic way
 */
export function getCurrentWorkingDirectory(): string {
  const runtime = detectRuntime();

  if (runtime.name === 'deno' && typeof Deno !== 'undefined' && 'cwd' in Deno) {
    return (Deno as { cwd: () => string }).cwd();
  }

  return process.cwd();
}

/**
 * Get command line arguments in a runtime-agnostic way
 */
export function getCommandLineArgs(): string[] {
  const runtime = detectRuntime();

  if (runtime.name === 'deno' && typeof Deno !== 'undefined' && 'args' in Deno) {
    return (Deno as { args: string[] }).args;
  }

  return process.argv.slice(2);
}

/**
 * Exit the process in a runtime-agnostic way
 */
export function exitProcess(code: number): never {
  const runtime = detectRuntime();

  if (runtime.name === 'deno' && typeof Deno !== 'undefined' && 'exit' in Deno) {
    (Deno as { exit: (code: number) => never }).exit(code);
  }

  process.exit(code);
}

/**
 * Read file in a runtime-agnostic way
 */
export async function readFile(path: string): Promise<Uint8Array> {
  const runtime = detectRuntime();

  if (runtime.name === 'deno' && typeof Deno !== 'undefined' && 'readFile' in Deno) {
    return await (Deno as { readFile: (path: string) => Promise<Uint8Array> }).readFile(path);
  }

  // For Node.js and Bun, use the fs module
  const fs = await import('node:fs/promises');
  const buffer = await fs.readFile(path);
  return new Uint8Array(buffer);
}

// Path operations are handled by pathUtils.ts using Node.js path module
// which is available in all supported runtimes (Node.js, Bun, Deno)
