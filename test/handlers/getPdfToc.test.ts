import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import * as pathUtils from '../../src/utils/pathUtils.js';

// --- Mocking pdfjs-dist ---
const mockGetOutline = vi.fn();
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
  const { getPdfTocToolDefinition: importedDefinition } = await import(
    '../../src/handlers/getPdfToc.js'
  );
  handler = importedDefinition.handler;
});

describe('getPdfToc Handler', () => {
  // const mockPdfDocument = {
  //   getOutline: mockGetOutline,
  //   numPages: 5,
  // };

  beforeEach(() => {
    vi.resetAllMocks();
    // Reset mocks for pathUtils if we spy on it
    vi.spyOn(pathUtils, 'resolvePath').mockImplementation((p) => p); // Simple mock for resolvePath

    mockReadFile.mockResolvedValue(Buffer.from('mock pdf content'));

    const mockDocumentAPI = {
      numPages: 5,
      getOutline: mockGetOutline,
    };
    const mockLoadingTaskAPI = { promise: Promise.resolve(mockDocumentAPI) };
    mockGetDocument.mockReturnValue(mockLoadingTaskAPI);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should extract table of contents successfully', async () => {
    const mockOutline = [
      {
        title: 'Chapter 1',
        dest: [1, { name: 'XYZ' }, 0, 0],
        items: [
          {
            title: 'Section 1.1',
            dest: [2, { name: 'XYZ' }, 0, 0],
          },
        ],
      },
      {
        title: 'Chapter 2',
        dest: [3, { name: 'XYZ' }, 0, 0],
      },
    ];

    mockGetOutline.mockResolvedValue(mockOutline);

    const args = {
      source: { path: 'test.pdf' },
      max_depth: 3,
    };

    const result = await handler(args);
    const parsedResult = JSON.parse(result.content[0].text);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.data?.outline).toEqual([
      {
        title: 'Chapter 1',
        page: 2,
        destination: [1, { name: 'XYZ' }, 0, 0],
        items: [
          {
            title: 'Section 1.1',
            page: 3,
            destination: [2, { name: 'XYZ' }, 0, 0],
          },
        ],
      },
      {
        title: 'Chapter 2',
        page: 4,
        destination: [3, { name: 'XYZ' }, 0, 0],
      },
    ]);
  });

  it('should handle PDF without table of contents', async () => {
    mockGetOutline.mockResolvedValue(null);

    const args = {
      source: { path: 'test.pdf' },
    };

    const result = await handler(args);
    const parsedResult = JSON.parse(result.content[0].text);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.data?.outline).toBeUndefined();
    expect(parsedResult.data?.warnings).toEqual(['No table of contents found in this PDF.']);
  });

  it('should respect max_depth parameter', async () => {
    const mockOutline = [
      {
        title: 'Chapter 1',
        dest: [1, { name: 'XYZ' }, 0, 0],
        items: [
          {
            title: 'Section 1.1',
            dest: [2, { name: 'XYZ' }, 0, 0],
            items: [
              {
                title: 'Subsection 1.1.1',
                dest: [3, { name: 'XYZ' }, 0, 0],
              },
            ],
          },
        ],
      },
    ];

    mockGetOutline.mockResolvedValue(mockOutline);

    const args = {
      source: { path: 'test.pdf' },
      max_depth: 2,
    };

    const result = await handler(args);
    const parsedResult = JSON.parse(result.content[0].text);

    expect(parsedResult.success).toBe(true);
    expect(parsedResult.data?.outline?.[0].items?.[0].items).toBeUndefined();
  });

  it('should handle file not found error', async () => {
    vi.spyOn(pathUtils, 'resolvePath').mockImplementation(() => {
      const error = new Error('ENOENT');
      (error as Error & { code: string }).code = 'ENOENT';
      throw error;
    });

    const args = {
      source: { path: 'nonexistent.pdf' },
    };

    const result = await handler(args);
    const parsedResult = JSON.parse(result.content[0].text);

    expect(parsedResult.success).toBe(false);
    expect(parsedResult.error).toContain('File not found');
  });

  it('should validate required parameters', async () => {
    const args = {} as unknown;

    await expect(handler(args)).rejects.toThrow(McpError);
  });

  it('should validate path or url presence', async () => {
    const args = {
      source: {},
    };

    await expect(handler(args)).rejects.toThrow(McpError);
  });

  it('should validate max_depth range', async () => {
    const args = {
      source: { path: 'test.pdf' },
      max_depth: 0,
    };

    await expect(handler(args)).rejects.toThrow(McpError);
  });

  it('should handle PDF loading errors', async () => {
    mockGetDocument.mockReturnValue({
      promise: Promise.reject(new Error('PDF loading failed')),
    });

    const args = {
      source: { path: 'corrupt.pdf' },
    };

    const result = await handler(args);
    const parsedResult = JSON.parse(result.content[0].text);

    expect(parsedResult.success).toBe(false);
    expect(parsedResult.error).toContain('Failed to load PDF document');
  });
});
