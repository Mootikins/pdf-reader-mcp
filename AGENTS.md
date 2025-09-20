# AGENTS.md - PDF Reader MCP Server

## Project Overview

**PDF Reader MCP Server** (@mootikins/pdf-reader-mcp) is a Model Context Protocol (MCP) server that provides secure PDF reading capabilities for AI agents like Claude. This is a fork of the original @sylphlab/pdf-reader-mcp with fixes for stdio output issues, configurable directory restrictions, and updated dependencies.

## Core Architecture

### MCP Server Structure

- **Entry Point**: `src/index.ts` - Sets up the MCP server with stdio transport
- **Tool Handler**: `src/handlers/readPdf.ts` - Main PDF processing logic with Zod validation
- **Tool Registry**: `src/handlers/index.ts` - Aggregates and exports tool definitions
- **Security**: `src/utils/pathUtils.ts` - Path resolution with security constraints

### Key Technologies

- **Runtime**: Node.js >=22.0.0
- **Protocol**: Model Context Protocol (MCP) via @modelcontextprotocol/sdk
- **PDF Processing**: pdfjs-dist for reliable PDF parsing
- **Validation**: Zod for input validation and type safety
- **Build**: TypeScript with strict configuration

## Available Tools

### `read_pdf`

**Primary tool for PDF content extraction**

**Capabilities:**

- Extract full text content from PDF files
- Extract text from specific pages or page ranges
- Retrieve PDF metadata (author, title, creation date, etc.)
- Get total page count
- Process multiple PDF sources (local paths or URLs) in single request
- Secure path resolution with configurable directory restrictions

### `get_pdf_toc`

**Extract table of contents/outline from PDF files**

**Capabilities:**

- Extract hierarchical table of contents with titles and page numbers
- Configure maximum depth of outline items to extract
- Preserve destination information for each outline item
- Handle PDFs without table of contents gracefully

**Input Schema:**

```typescript
{
  source: {
    path?: string;     // Relative path to local PDF
    url?: string;      // URL to remote PDF
  };
  max_depth?: number;  // Maximum depth to extract (default: 5)
}
```

**Output Format:**

```typescript
{
  success: boolean;
  data?: {
    outline?: Array<{
      title: string;
      page?: number;
      destination?: unknown;
      items?: Array<...>; // Nested outline items
    }>;
    warnings?: string[];
  };
  error?: string;
}
```

### `search_pdf_text`

**Search for text within PDF files with configurable context depth**

**Capabilities:**

- Search for specific text with case-sensitive or case-insensitive matching
- Configure context depth around matches (0-5 levels)
- Return surrounding text context based on depth setting
  - Depth 0: Match word + surrounding words only
  - Depth 1-5: Increasing context (block → section → chapter → part → full page)
- Limit number of results with pagination support
- Search specific pages or entire document
- Return page numbers for all matches

**Input Schema:**

```typescript
{
  source: {
    path?: string;     // Relative path to local PDF
    url?: string;      // URL to remote PDF
  };
  query: string;       // Text to search for
  depth?: number;      // Context depth: 0-5 (default: 0)
  max_results?: number; // Maximum results (default: 20)
  page?: number;       // Specific page to search (optional)
  case_sensitive?: boolean; // Case sensitive search (default: false)
  context_words?: number; // Surrounding words for depth=0 (default: 5)
}
```

**Output Format:**

```typescript
{
  success: boolean;
  data?: {
    results: Array<{
      page: number;
      text: string;        // Matched text
      match_start: number; // Start position
      match_end: number;   // End position
      context?: string;    // Context based on depth
    }>;
    total_matches: number;
    warnings?: string[];
  };
  error?: string;
}
```

**Output Format:**

```typescript
{
  results: Array<{
    source: string;
    success: boolean;
    data?: {
      info?: object; // PDF info object
      metadata?: object; // PDF metadata
      num_pages?: number; // Total pages
      full_text?: string; // Complete text content
      page_texts?: Array<{
        // Specific page texts
        page: number;
        text: string;
      }>;
      warnings?: string[]; // Any processing warnings
    };
    error?: string;
  }>;
}
```

## Security Features

### Path Security

- **Configurable Directory Restrictions**: Optionally restrict file access to specific directories via command line arguments
- **Project Root Fallback**: Defaults to server's working directory when no restrictions specified
- **Path Traversal Protection**: Prevents access outside allowed boundaries via `../` sequences
- **Absolute Path Rejection**: Only relative paths allowed for local files
- **Input Validation**: Strict Zod schema validation for all inputs

### Error Handling

- Graceful handling of missing files, invalid PDFs, and network errors
- Detailed error messages without exposing system information
- Warnings for invalid page requests without failing entire operation

## Development Tools

### Scripts Available

- `pnpm build` - Compile TypeScript to JavaScript
- `pnpm test` - Run test suite with Vitest
- `pnpm test:cov` - Generate coverage reports
- `pnpm lint` - ESLint with TypeScript support
- `pnpm format` - Prettier code formatting
- `pnpm validate` - Full validation pipeline (format + lint + test)
- `pnpm benchmark` - Performance benchmarking
- `pnpm docs:dev` - Development documentation server
- `pnpm inspector` - MCP protocol inspector tool

### Testing Infrastructure

- **Framework**: Vitest for testing and benchmarking
- **Coverage**: @vitest/coverage-v8 for coverage reporting
- **Fixtures**: Sample PDF files in `test/fixtures/`
- **Benchmarks**: Performance tests in `test/benchmark/`

### Code Quality

- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier with consistent configuration
- **Commit Hooks**: Husky for pre-commit validation
- **Commit Convention**: Conventional commits via commitlint

## Deployment Options

### NPM Package (Recommended)

```bash
pnpm add @mootikins/pdf-reader-mcp
npx @mootikins/pdf-reader-mcp

# With directory restrictions
npx @mootikins/pdf-reader-mcp /path/to/documents /path/to/pdfs
```

### Local Development

```bash
git clone https://github.com/Mootikins/pdf-reader-mcp.git
cd pdf-reader-mcp
pnpm install && pnpm build
node dist/index.js

# With directory restrictions
node dist/index.js /path/to/documents /path/to/pdfs
```

## Performance Characteristics

Based on benchmarks with sample PDFs:

- **Error Handling**: ~12,933 ops/sec (non-existent files)
- **Full Text Extraction**: ~5,575 ops/sec
- **Single Page**: ~5,329 ops/sec
- **Multiple Pages**: ~5,242 ops/sec
- **Metadata Only**: ~4,912 ops/sec

## Integration Guidelines

### MCP Host Configuration

Configure in your MCP host's settings (e.g., `mcp_settings.json`):

```json
{
  "mcpServers": {
    "pdf-reader-mcp": {
      "command": "npx",
      "args": ["@mootikins/pdf-reader-mcp"],
      "name": "PDF Reader"
    }
  }
}
```

**With Directory Restrictions:**

```json
{
  "mcpServers": {
    "pdf-reader-mcp": {
      "command": "npx",
      "args": ["@mootikins/pdf-reader-mcp", "/path/to/documents", "/path/to/pdfs"],
      "name": "PDF Reader (Restricted)"
    }
  }
}
```

### Usage Patterns

1. **Document Analysis**: Extract full text for content analysis
2. **Selective Reading**: Get specific pages for focused extraction
3. **Metadata Inspection**: Retrieve document properties and info
4. **Multi-Source Processing**: Handle multiple PDFs in single request
5. **URL Processing**: Access remote PDFs via HTTPS
6. **Restricted Access**: Limit PDF access to specific directories for enhanced security
7. **Table of Contents Extraction**: Navigate PDF structure using outline/bookmarks
8. **Text Search with Context**: Find content with configurable context depth for precise results

### Error Recovery

The server handles errors gracefully:

- Invalid PDFs return structured error messages
- Missing pages generate warnings but don't fail the operation
- Network issues with URLs are reported per-source
- Path security violations throw descriptive errors
- Directory restriction violations are clearly reported

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, testing procedures, and contribution guidelines.

## Maintenance

This fork is maintained by [@Mootikins](https://github.com/Mootikins) with focus on:

- Resolving stdio output compatibility issues
- Adding configurable directory restrictions for enhanced security
- Keeping dependencies updated and secure
- Improving error handling and robustness
- Maintaining compatibility with MCP protocol updates
