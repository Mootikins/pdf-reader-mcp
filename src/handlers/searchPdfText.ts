import { z } from 'zod';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFile } from '../utils/runtime.js';
import { resolvePath } from '../utils/pathUtils.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ToolDefinition } from './index.js';

// --- Zod Schemas ---
const PdfSearchSourceSchema = z
  .object({
    path: z.string().min(1).optional().describe('Relative path to the local PDF file.'),
    url: z.string().url().optional().describe('URL of the PDF file.'),
  })
  .strict()
  .refine((data) => !!(data.path && !data.url) || !!(!data.path && data.url), {
    message: "Source must have either 'path' or 'url', but not both.",
  });

const SearchPdfTextArgsSchema = z
  .object({
    source: PdfSearchSourceSchema.describe('The PDF source to search within.'),
    query: z.string().min(1).describe('The text to search for in the PDF.'),
    depth: z
      .number()
      .int()
      .min(0)
      .max(5)
      .optional()
      .default(0)
      .describe(
        'Context depth: 0=just the word+surrounding text, 1=current block, 2=current section, 3=current chapter, 4=current part, 5=entire page.'
      ),
    max_results: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .describe('Maximum number of results to return.'),
    page: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Specific page to search (1-based). If not provided, searches all pages.'),
    case_sensitive: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to perform a case-sensitive search.'),
    context_words: z
      .number()
      .int()
      .min(0)
      .max(50)
      .optional()
      .default(5)
      .describe('Number of surrounding words to include when depth=0.'),
  })
  .strict();

type SearchPdfTextArgs = z.infer<typeof SearchPdfTextArgsSchema>;

// --- Result Type Interfaces ---
interface SearchResult {
  page: number;
  text: string;
  match_start: number;
  match_end: number;
  context?: string;
}

interface SearchResultData {
  results: SearchResult[];
  total_matches: number;
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
      const fileBuffer = await readFile(safePath);
      pdfDataSource = fileBuffer;
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

// Extract text with structural information
interface TextContent {
  items: (TextItem | TextMarkedContent)[];
  styles: Record<string, unknown>;
}

interface TextItem {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
  hasEOL: boolean;
}

interface TextMarkedContent {
  type: string;
}

// Get context around a match based on depth level
const getContextAroundMatch = (
  textContent: TextContent,
  matchIndex: number,
  depth: number,
  contextWords: number
): string => {
  // Filter out TextMarkedContent items
  const textItems = textContent.items.filter((item): item is TextItem => 'str' in item);

  if (depth === 0) {
    // Just surrounding words
    const words = textItems.map((item) => item.str);
    const start = Math.max(0, matchIndex - contextWords);
    const end = Math.min(words.length, matchIndex + contextWords + 1);
    return words.slice(start, end).join(' ');
  } else {
    // For depth > 0, we would need more sophisticated parsing to identify blocks/sections
    // For now, we'll return the entire page content for depths 1-5
    // TODO: Implement proper structural analysis for different depth levels
    return textItems.map((item) => item.str).join('');
  }
};

// Search for text in a specific page
 
const searchPage = async (
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  query: string,
  depth: number,
  contextWords: number,
  caseSensitive: boolean
): Promise<SearchResult[]> => {
  const results: SearchResult[] = [];

  try {
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    const fullText = textContent.items
      .filter((item): item is TextItem => 'str' in item)
      .map((item) => item.str)
      .join(' ');

    // Prepare search parameters
    const searchText = caseSensitive ? query : query.toLowerCase();
    const searchTarget = caseSensitive ? fullText : fullText.toLowerCase();

    let offset = 0;
    while (offset < searchTarget.length) {
      const matchIndex = searchTarget.indexOf(searchText, offset);
      if (matchIndex === -1) break;

      // Find the corresponding text item
      let charCount = 0;
      let itemIndex = -1;
      for (let i = 0; i < textContent.items.length; i++) {
        const item = textContent.items[i];
        if (item && 'str' in item) {
          if (charCount <= matchIndex && charCount + item.str.length > matchIndex) {
            itemIndex = i;
            break;
          }
          charCount += item.str.length + 1; // +1 for space
        }
      }

      const context =
        itemIndex >= 0 ? getContextAroundMatch(textContent, itemIndex, depth, contextWords) : '';

      results.push({
        page: pageNum,
        text: query,
        match_start: matchIndex,
        match_end: matchIndex + searchText.length,
        context,
      });

      offset = matchIndex + 1;
    }
  } catch (error) {
    console.warn(`[PDF Reader MCP] Error searching page ${String(pageNum)}:`, error);
  }

  return results;
};

// --- Main Handler Function ---
export const handleSearchPdfTextFunc = async (
  args: unknown
): Promise<{ content: { type: string; text: string }[] }> => {
  let parsedArgs: SearchPdfTextArgs;
  try {
    parsedArgs = SearchPdfTextArgsSchema.parse(args);
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

  const { source, query, depth, max_results, page, case_sensitive, context_words } = parsedArgs;
  const sourceDescription: string = source.path ?? source.url ?? 'unknown source';
  const result: { success: boolean; data?: SearchResultData; error?: string } = {
    success: false,
  };

  try {
    // Load PDF document
    const pdfDocument = await loadPdfDocument(source, sourceDescription);

    // Determine pages to search
    const startPage = page ? Math.min(page, pdfDocument.numPages) : 1;
    const endPage = page ? startPage : pdfDocument.numPages;

    const allResults: SearchResult[] = [];
    const warnings: string[] = [];

    // Search each page
    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      const pageResults = await searchPage(
        pdfDocument,
        pageNum,
        query,
        depth,
        context_words,
        case_sensitive
      );
      allResults.push(...pageResults);

      // Stop if we've reached max_results
      if (allResults.length >= max_results) {
        break;
      }
    }

    // Sort results by page and position
    allResults.sort((a, b) => {
      if (a.page !== b.page) {
        return a.page - b.page;
      }
      return a.match_start - b.match_start;
    });

    // Limit results
    const limitedResults = allResults.slice(0, max_results);

    if (allResults.length > max_results) {
      warnings.push(
        `Found ${String(allResults.length)} matches, but only returning first ${String(max_results)} results.`
      );
    }

    const data: SearchResultData = {
      results: limitedResults,
      total_matches: allResults.length,
    };

    if (warnings.length > 0) {
      data.warnings = warnings;
    }

    result.data = data;
    result.success = true;
  } catch (error: unknown) {
    let errorMessage = `Failed to search text in ${sourceDescription}.`;
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
export const searchPdfTextToolDefinition: ToolDefinition = {
  name: 'search_pdf_text',
  description: 'Search for text within a PDF file with configurable context depth.',
  schema: SearchPdfTextArgsSchema,
  handler: handleSearchPdfTextFunc,
};
