import path from 'path';
// Removed unused import: import { fileURLToPath } from 'url';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Valid root directories for PDF access (absolute paths)
// If empty, falls back to CWD for backwards compatibility
let validRootDirectories: string[] = [];

// Use console.warn for server logging in stdio mode to avoid interfering with MCP protocol
console.warn(`[PDF Reader MCP - pathUtils] Initializing path utilities`);

/**
 * Sets the valid root directories for PDF access.
 * @param directories Array of absolute directory paths
 */
export const setValidRootDirectories = (directories: string[]): void => {
  validRootDirectories = directories.map((dir) => path.resolve(dir));
  console.warn(
    `[PDF Reader MCP - pathUtils] Valid root directories set to: ${validRootDirectories.join(', ')}`
  );
};

/**
 * Gets the current valid root directories.
 * @returns Array of absolute directory paths, or [process.cwd()] if none set
 */
export const getValidRootDirectories = (): string[] => {
  return validRootDirectories.length > 0 ? validRootDirectories : [process.cwd()];
};

/**
 * Resolves a user-provided relative path against the valid root directories,
 * ensuring it stays within the allowed boundaries.
 * Throws McpError on invalid input, absolute paths, or path traversal.
 * @param userPath The relative path provided by the user.
 * @returns The resolved absolute path.
 */
export const resolvePath = (userPath: string): string => {
  if (typeof userPath !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, 'Path must be a string.');
  }

  const normalizedUserPath = path.normalize(userPath);
  if (path.isAbsolute(normalizedUserPath)) {
    throw new McpError(ErrorCode.InvalidParams, 'Absolute paths are not allowed.');
  }

  const allowedRoots = getValidRootDirectories();

  // Try to resolve against each valid root directory
  for (const rootDir of allowedRoots) {
    const resolved = path.resolve(rootDir, normalizedUserPath);

    // Security check: Ensure the resolved path is still within this root
    if (resolved.startsWith(rootDir + path.sep) || resolved === rootDir) {
      return resolved;
    }
  }

  // If we get here, the path doesn't resolve to any valid directory
  throw new McpError(
    ErrorCode.InvalidRequest,
    `Path '${userPath}' is not within any allowed directory. Allowed directories: ${allowedRoots.join(', ')}`
  );
};
