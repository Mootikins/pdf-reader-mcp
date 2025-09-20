import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import * as pathUtils from '../../src/utils/pathUtils.js';

// --- Mocking pdfjs-dist ---
const mockGetPage = vi.fn();
const mockGetTextContent = vi.fn();
const mockGetDocument = vi.fn();
const mockReadFile = vi.fn();

vi.doMock('pdfjs-dist/legacy/build/pdf.mjs', () => {
  return {
    getDocument: mockGetDocument,
  };
});
vi.doMock('node:fs/promises', () => {
  return {
    default: {
      readFile: mockReadFile,
    },
    readFile: mockReadFile,
    __esModule: true,
  };
});

// Dynamically import the handler *once* after mocks are defined
let handler: (args: unknown) => Promise<{ content: { type: string; text: string }[] }>;

beforeAll(async () => {
  const { searchPdfTextToolDefinition: importedDefinition } = await import(
    '../../src/handlers/searchPdfText.js'
  );
  handler = importedDefinition.handler;
});

describe('searchPdfText Handler', () => {
  const mockPage = {
    getTextContent: mockGetTextContent,
  };

  const mockPdfDocument = {
    getPage: mockGetPage,
    numPages: 5,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    // Reset mocks for pathUtils if we spy on it
    vi.spyOn(pathUtils, 'resolvePath').mockImplementation((p) => p); // Simple mock for resolvePath

    mockReadFile.mockResolvedValue(Buffer.from('mock pdf content'));

    const mockDocumentAPI = {
      numPages: 5,
      getPage: mockGetPage,
    };
    const mockLoadingTaskAPI = { promise: Promise.resolve(mockDocumentAPI) };
    mockGetDocument.mockReturnValue(mockLoadingTaskAPI);

    // Default page behavior
    mockGetPage.mockResolvedValue(mockPage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should search text successfully with depth 0', async () => {
    const mockTextContent = {
      items: [
        { str: 'This', hasEOL: false },
        { str: 'is', hasEOL: false },
        { str: 'a', hasEOL: false },
        { str: 'test', hasEOL: true },
        { str: 'document', hasEOL: true },
      ],
      styles: {},
    };

    mockGetTextContent.mockResolvedValue(mockTextContent);

    const args = {
      source: { path: 'test.pdf' },
      query: 'test',
      depth: 0,
      max_results: 10,
      page: 1, // Search only page 1
    };

    const result = await handler(args);
    const parsedResult = JSON.parse(result.content[0].text);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.data?.results).toHaveLength(1);
    expect(parsedResult.data?.results[0].text).toBe('test');
    expect(parsedResult.data?.results[0].page).toBe(1);
    expect(parsedResult.data?.total_matches).toBe(1);
  });

  it('should search text case-insensitively', async () => {
    const mockTextContent = {
      items: [
        { str: 'TEST', hasEOL: true },
        { str: 'test', hasEOL: true },
      ],
      styles: {},
    };

    mockGetTextContent.mockResolvedValue(mockTextContent);

    const args = {
      source: { path: 'test.pdf' },
      query: 'test',
      case_sensitive: false,
      page: 1, // Search only page 1
    };

    const result = await handler(args);
    const parsedResult = JSON.parse(result.content[0].text);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.data?.results).toHaveLength(2);
  });

  it('should search text case-sensitively', async () => {
    const mockTextContent = {
      items: [
        { str: 'TEST', hasEOL: true },
        { str: 'test', hasEOL: true },
      ],
      styles: {},
    };

    mockGetTextContent.mockResolvedValue(mockTextContent);

    const args = {
      source: { path: 'test.pdf' },
      query: 'test',
      case_sensitive: true,
      page: 1, // Search only page 1
    };

    const result = await handler(args);
    const parsedResult = JSON.parse(result.content[0].text);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.data?.results).toHaveLength(1);
    expect(parsedResult.data?.results[0].text).toBe('test');
  });

  it('should search specific page when requested', async () => {
    const mockTextContent = {
      items: [{ str: 'test', hasEOL: true }],
      styles: {},
    };

    mockGetTextContent.mockResolvedValue(mockTextContent);

    const args = {
      source: { path: 'test.pdf' },
      query: 'test',
      page: 3,
    };

    const result = await handler(args);
    const parsedResult = JSON.parse(result.content[0].text);

    expect(parsedResult.success).toBe(true);
    expect(mockGetPage).toHaveBeenCalledWith(3);
    expect(parsedResult.data?.results[0].page).toBe(3);
  });

  it('should respect max_results limit', async () => {
    const mockTextContent = {
      items: Array(30)
        .fill(null)
        .map(() => ({ str: 'test', hasEOL: false })),
      styles: {},
    };

    mockGetTextContent.mockResolvedValue(mockTextContent);

    const args = {
      source: { path: 'test.pdf' },
      query: 'test',
      max_results: 5,
    };

    const result = await handler(args);
    const parsedResult = JSON.parse(result.content[0].text);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.data?.results).toHaveLength(5);
    expect(parsedResult.data?.total_matches).toBe(30);
    expect(parsedResult.data?.warnings).toContain(
      'Found 30 matches, but only returning first 5 results.'
    );
  });

  it('should handle no matches found', async () => {
    const mockTextContent = {
      items: [
        { str: 'This', hasEOL: true },
        { str: 'document', hasEOL: true },
      ],
      styles: {},
    };

    mockGetTextContent.mockResolvedValue(mockTextContent);

    const args = {
      source: { path: 'test.pdf' },
      query: 'nonexistent',
    };

    const result = await handler(args);
    const parsedResult = JSON.parse(result.content[0].text);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.data?.results).toHaveLength(0);
    expect(parsedResult.data?.total_matches).toBe(0);
  });

  it('should validate required parameters', async () => {
    const args = {} as any;

    await expect(handler(args)).rejects.toThrow(McpError);
  });

  it('should validate query parameter', async () => {
    const args = {
      source: { path: 'test.pdf' },
      query: '',
    };

    await expect(handler(args)).rejects.toThrow(McpError);
  });

  it('should validate depth range', async () => {
    const args = {
      source: { path: 'test.pdf' },
      query: 'test',
      depth: 6,
    };

    await expect(handler(args)).rejects.toThrow(McpError);
  });

  it('should validate context_words range', async () => {
    const args = {
      source: { path: 'test.pdf' },
      query: 'test',
      context_words: -1,
    };

    await expect(handler(args)).rejects.toThrow(McpError);
  });

  it('should handle file not found error', async () => {
    vi.spyOn(pathUtils, 'resolvePath').mockImplementation(() => {
      const error = new Error('ENOENT');
      (error as any).code = 'ENOENT';
      throw error;
    });

    const args = {
      source: { path: 'nonexistent.pdf' },
      query: 'test',
    };

    const result = await handler(args);
    const parsedResult = JSON.parse(result.content[0].text);

    expect(parsedResult.success).toBe(false);
    expect(parsedResult.error).toContain('File not found');
  });

  it('should handle PDF loading errors', async () => {
    mockGetDocument.mockReturnValue({
      promise: Promise.reject(new Error('PDF loading failed')),
    });

    const args = {
      source: { path: 'corrupt.pdf' },
      query: 'test',
    };

    const result = await handler(args);
    const parsedResult = JSON.parse(result.content[0].text);

    expect(parsedResult.success).toBe(false);
    expect(parsedResult.error).toContain('Failed to load PDF document');
  });

  it('should search all pages when no specific page is given', async () => {
    const mockTextContent = {
      items: [{ str: 'test', hasEOL: true }],
      styles: {},
    };

    mockGetTextContent.mockResolvedValue(mockTextContent);

    const args = {
      source: { path: 'test.pdf' },
      query: 'test',
    };

    await handler(args);

    expect(mockGetPage).toHaveBeenCalledWith(1);
  });

  it('should handle empty text content gracefully', async () => {
    const mockTextContent = {
      items: [],
      styles: {},
    };

    mockGetTextContent.mockResolvedValue(mockTextContent);

    const args = {
      source: { path: 'test.pdf' },
      query: 'test',
    };

    const result = await handler(args);
    const parsedResult = JSON.parse(result.content[0].text);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.data?.results).toHaveLength(0);
  });

  it('should handle TextMarkedContent items in text content', async () => {
    const mockTextContent = {
      items: [
        { type: 'marked-content' },
        { str: 'test', hasEOL: true },
        { type: 'marked-content' },
      ],
      styles: {},
    };

    mockGetTextContent.mockResolvedValue(mockTextContent);

    const args = {
      source: { path: 'test.pdf' },
      query: 'test',
      page: 1, // Search only page 1
    };

    const result = await handler(args);
    const parsedResult = JSON.parse(result.content[0].text);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.data?.results).toHaveLength(1);
  });
});
