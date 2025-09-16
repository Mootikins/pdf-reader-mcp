[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/sylphxltd-pdf-reader-mcp-badge.png)](https://mseep.ai/app/sylphxltd-pdf-reader-mcp)

# PDF Reader MCP Server (@mootikins/pdf-reader-mcp)

> **Fork Notice**: This is a fork of the original [@sylphlab/pdf-reader-mcp](https://github.com/sylphxltd/pdf-reader-mcp) by [SylphLab](https://sylphlab.ai). This version includes fixes for stdio output issues and is maintained by [@Mootikins](https://github.com/Mootikins).

<!-- Status Badges Area -->

[![CI/CD Pipeline](https://github.com/sylphlab/pdf-reader-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sylphlab/pdf-reader-mcp/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/sylphlab/pdf-reader-mcp/graph/badge.svg?token=VYRQFB40UN)](https://codecov.io/gh/sylphlab/pdf-reader-mcp)
[![npm version](https://badge.fury.io/js/%40sylphlab%2Fpdf-reader-mcp.svg)](https://badge.fury.io/js/%40sylphlab%2Fpdf-reader-mcp)
[![Docker Pulls](https://img.shields.io/docker/pulls/sylphlab/pdf-reader-mcp.svg)](https://hub.docker.com/r/sylphlab/pdf-reader-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<!-- End Status Badges Area -->

Empower your AI agents (like Cline) with the ability to securely read and extract information (text, metadata, page count) from PDF files within your project context using a single, flexible tool.

<a href="https://glama.ai/mcp/servers/@sylphlab/pdf-reader-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@sylphlab/pdf-reader-mcp/badge" alt="PDF Reader Server MCP server" />
</a>

## Installation

### Using npm (Recommended)

Install as a dependency in your MCP host environment or project:

```bash
pnpm add @mootikins/pdf-reader-mcp # Or npm install / yarn add
```

Configure your MCP host (e.g., `mcp_settings.json`) to use `npx`:

```json
{
  "mcpServers": {
    "pdf-reader-mcp": {
      "command": "npx",
      "args": ["@mootikins/pdf-reader-mcp"],
      "name": "PDF Reader (npx)"
    }
  }
}
```

**Optional: Restrict PDF Access to Specific Directories**

For enhanced security, you can restrict PDF access to specific directories by passing them as command arguments:

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

When directory arguments are provided, the server will only allow PDF access within those specified directories, providing an additional security layer beyond the default project root confinement.

### Using Docker

> **Note**: Docker support is not currently available in this fork. Use npm installation instead.

### Local Build (For Development)

1. Clone: `git clone https://github.com/Mootikins/pdf-reader-mcp.git`
2. Install: `cd pdf-reader-mcp && pnpm install`
3. Build: `pnpm run build`
4. Configure MCP Host:
   ```json
   {
     "mcpServers": {
       "pdf-reader-mcp": {
         "command": "node",
         "args": ["/path/to/cloned/repo/pdf-reader-mcp/dist/index.js"],
         "name": "PDF Reader (Local Build)"
       }
     }
   }
   ```

**Directory Restrictions for Local Builds:**

You can also restrict directory access when using local builds by adding directory arguments:

```json
{
  "mcpServers": {
    "pdf-reader-mcp": {
      "command": "node",
      "args": [
        "/path/to/cloned/repo/pdf-reader-mcp/dist/index.js",
        "/restricted/to/documents",
        "/restricted/to/pdfs"
      ],
      "name": "PDF Reader (Local Restricted)"
    }
  }
}
```

## Quick Start

Assuming the server is running and configured in your MCP host:

**MCP Request (Get metadata and page 2 text from a local PDF):**

```json
{
  "tool_name": "read_pdf",
  "arguments": {
    "sources": [
      {
        "path": "./documents/my_report.pdf",
        "pages": [2]
      }
    ],
    "include_metadata": true,
    "include_page_count": false, // Default is true, explicitly false here
    "include_full_text": false // Ignored because 'pages' is specified
  }
}
```

**Expected Response Snippet:**

```json
{
  "results": [
    {
      "source": "./documents/my_report.pdf",
      "success": true,
      "data": {
        "page_texts": [
          { "page": 2, "text": "Text content from page 2..." }
        ],
        "info": { ... },
        "metadata": { ... }
        // num_pages not included as requested
      }
    }
  ]
}
```

## What's New in This Fork?

- **🔧 Fixed stdio output issues**: Resolved problems with stderr output that could interfere with MCP communication
- **🔒 Directory restriction support**: Added ability to restrict PDF access to specific directories via command line arguments
- **📦 Updated dependencies**: Latest security patches and dependency updates
- **🛠️ Maintained by @Mootikins**: Active maintenance and issue resolution

## Why Choose This Project?

- **🛡️ Secure:** Confines file access to project root directory, with optional restriction to specific directories.
- **🌐 Flexible:** Handles both local relative paths and public URLs.
- **🧩 Consolidated:** A single `read_pdf` tool serves multiple extraction needs (full text, specific pages, metadata, page count).
- **⚙️ Structured Output:** Returns data in a predictable JSON format, easy for agents to parse.
- **🚀 Easy Integration:** Designed for seamless use within MCP environments via `npx`.
- **✅ Robust:** Uses `pdfjs-dist` for reliable parsing and Zod for input validation.

## Performance Advantages

Initial benchmarks using Vitest on a sample PDF show efficient handling of various operations:

| Scenario                         | Operations per Second (hz) | Relative Speed |
| :------------------------------- | :------------------------- | :------------- |
| Handle Non-Existent File         | ~12,933                    | Fastest        |
| Get Full Text                    | ~5,575                     |                |
| Get Specific Page (Page 1)       | ~5,329                     |                |
| Get Specific Pages (Pages 1 & 2) | ~5,242                     |                |
| Get Metadata & Page Count        | ~4,912                     | Slowest        |

_(Higher hz indicates better performance. Results may vary based on PDF complexity and environment.)_

See the [Performance Documentation](./docs/performance/index.md) for more details and future plans.

## Features

- Read full text content from PDF files.
- Read text content from specific pages or page ranges.
- Read PDF metadata (author, title, creation date, etc.).
- Get the total page count of a PDF.
- Process multiple PDF sources (local paths or URLs) in a single request.
- Securely operates within the defined project root, with optional directory restrictions.
- Provides structured JSON output via MCP.
- Available via npm.

## Design Philosophy

The server prioritizes security through context confinement, efficiency via structured data transfer, and simplicity for easy integration into AI agent workflows. It aims for minimal dependencies, relying on the robust `pdfjs-dist` library.

See the full [Design Philosophy](./docs/design/index.md) documentation.

## Comparison with Other Solutions

Compared to direct file access (often infeasible) or generic filesystem tools, this server offers PDF-specific parsing capabilities. Unlike external CLI tools (e.g., `pdftotext`), it provides a secure, integrated MCP interface with structured output, enhancing reliability and ease of use for AI agents.

See the full [Comparison](./docs/comparison/index.md) documentation.

## Future Plans (Roadmap)

- **Documentation:**
  - Finalize all documentation sections (Guide, API, Design, Comparison).
  - Resolve TypeDoc issue and generate API documentation.
  - Add more examples and advanced usage patterns.
  - Implement PWA support and mobile optimization for the docs site.
  - Add share buttons and growth metrics to the docs site.
- **Benchmarking:**
  - Conduct comprehensive benchmarks with diverse PDF files (size, complexity).
  - Measure memory usage.
  - Compare URL vs. local file performance.
- **Core Functionality:**
  - Explore potential optimizations for very large PDF files.
  - Investigate options for extracting images or annotations (longer term).
- **Testing:**
  - Increase test coverage towards 100% where practical.
  - Add runtime tests once feasible.

## Documentation

For detailed usage, API reference, and guides, please visit the **[Full Documentation Website](https://sylphlab.github.io/pdf-reader-mcp/)** (Link to be updated upon deployment).

## Community & Support

- **Found a bug or have a feature request?** Please open an issue on [GitHub Issues](https://github.com/Mootikins/pdf-reader-mcp/issues).
- **Want to contribute?** We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md).
- **Star & Watch:** If you find this project useful, please consider starring ⭐ and watching 👀 the repository on [GitHub](https://github.com/Mootikins/pdf-reader-mcp) to show your support and stay updated!

## Original Project

This project is based on the excellent work by [SylphLab](https://sylphlab.ai). Please check out their [original repository](https://github.com/sylphxltd/pdf-reader-mcp) and consider supporting their work as well.

## License

This project is licensed under the [MIT License](./LICENSE).
