import { z } from 'zod';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs/promises';
import { resolvePath } from '../utils/pathUtils.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ToolDefinition } from './index.js';

// --- Zod Schemas ---
const PdfTocSourceSchema = z
  .object({
    path: z.string().min(1).optional().describe('Relative path to the local PDF file.'),
    url: z.string().url().optional().describe('URL of the PDF file.'),
  })
  .strict()
  .refine((data) => !!(data.path && !data.url) || !!(!data.path && data.url), {
    message: "Source must have either 'path' or 'url', but not both.",
  });

const GetPdfTocArgsSchema = z
  .object({
    source: PdfTocSourceSchema.describe('The PDF source to extract table of contents from.'),
    max_depth: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .default(5)
      .describe('Maximum depth of outline items to extract.'),
  })
  .strict();

type GetPdfTocArgs = z.infer<typeof GetPdfTocArgsSchema>;

// --- Result Type Interfaces ---
interface TocItem {
  title: string;
  page?: number;
  destination?: unknown;
  items?: TocItem[];
}

interface TocResultData {
  outline?: TocItem[];
  warnings?: string[];
}

// --- Helper Functions ---

// Load PDF document (reusing from readPdf.ts)
const loadPdfDocument = async (
  source: { path?: string | undefined; url?: string | undefined },
  sourceDescription: string
): Promise<pdfjsLib.PDFDocumentProxy> => {
  let pdfDataSource: Uint8Array | { url: string };
  try {
    if (source.path) {
      const safePath = resolvePath(source.path);
      const fileBuffer = await fs.readFile(safePath);
      pdfDataSource = new Uint8Array(fileBuffer);
    } else if (source.url) {
      pdfDataSource = { url: source.url };
    } else {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Source ${sourceDescription} missing 'path' or 'url'.`
      );
    }
  } catch (err: unknown) {
    let errorMessage: string;
    const message = err instanceof Error ? err.message : String(err);
    const errorCode = ErrorCode.InvalidRequest;

    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      err.code === 'ENOENT' &&
      source.path
    ) {
      errorMessage = `File not found at '${source.path}'.`;
    } else {
      errorMessage = `Failed to prepare PDF source ${sourceDescription}. Reason: ${message}`;
    }
    throw new McpError(errorCode, errorMessage, { cause: err instanceof Error ? err : undefined });
  }

  const loadingTask = pdfjsLib.getDocument(pdfDataSource);
  try {
    return await loadingTask.promise;
  } catch (err: unknown) {
    console.error(`[PDF Reader MCP] PDF.js loading error for ${sourceDescription}:`, err);
    const message = err instanceof Error ? err.message : String(err);
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Failed to load PDF document from ${sourceDescription}. Reason: ${message || 'Unknown loading error'}`,
      { cause: err instanceof Error ? err : undefined }
    );
  }
};

// Recursive function to extract outline items with depth limit
const extractOutlineItems = (
  items: unknown[],
  currentDepth: number,
  maxDepth: number
): TocItem[] => {
  if (currentDepth > maxDepth) {
    return [];
  }

  return items
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null && 'title' in item
    )
    .map((item) => {
      const tocItem: TocItem = {
        title: (item['title'] as string) || '',
      };

      // Extract page number if available
      if (typeof item['dest'] === 'string' || Array.isArray(item['dest'])) {
        tocItem.destination = item['dest'];
      }

      // Try to extract page number from destination
      const dest = item['dest'];
      if (Array.isArray(dest) && dest.length > 0) {
        const destPage = dest[0];
        if (typeof destPage === 'number') {
          tocItem.page = destPage + 1; // PDF.js uses 0-based indexing
        }
      }

      // Recursively extract child items
      if (
        'items' in item &&
        Array.isArray(item['items']) &&
        item['items'].length > 0 &&
        currentDepth < maxDepth
      ) {
        tocItem.items = extractOutlineItems(item['items'], currentDepth + 1, maxDepth);
      }

      return tocItem;
    });
};

// --- Main Handler Function ---
export const handleGetPdfTocFunc = async (
  args: unknown
): Promise<{ content: { type: string; text: string }[] }> => {
  let parsedArgs: GetPdfTocArgs;
  try {
    parsedArgs = GetPdfTocArgsSchema.parse(args);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid arguments: ${error.errors.map((e) => `${e.path.join('.')} (${e.message})`).join(', ')}`
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new McpError(ErrorCode.InvalidParams, `Argument validation failed: ${message}`);
  }

  const { source, max_depth } = parsedArgs;
  const sourceDescription: string = source.path ?? source.url ?? 'unknown source';
  const result: { success: boolean; data?: TocResultData; error?: string } = {
    success: false,
  };

  try {
    // Load PDF document
    const pdfDocument = await loadPdfDocument(source, sourceDescription);

    // Get outline/table of contents
    const outline = await pdfDocument.getOutline();
    const data: TocResultData = {};

    if (outline && outline.length > 0) {
      data.outline = extractOutlineItems(outline, 1, max_depth);
    } else {
      data.warnings = ['No table of contents found in this PDF.'];
    }

    result.data = data;
    result.success = true;
  } catch (error: unknown) {
    let errorMessage = `Failed to extract table of contents from ${sourceDescription}.`;
    if (error instanceof McpError) {
      errorMessage = error.message;
    } else if (error instanceof Error) {
      errorMessage += ` Reason: ${error.message}`;
    } else {
      errorMessage += ` Unknown error: ${JSON.stringify(error)}`;
    }
    result.error = errorMessage;
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
};

// Export the ToolDefinition
export const getPdfTocToolDefinition: ToolDefinition = {
  name: 'get_pdf_toc',
  description: 'Extracts the table of contents/outline from a PDF file.',
  schema: GetPdfTocArgsSchema,
  handler: handleGetPdfTocFunc,
};
