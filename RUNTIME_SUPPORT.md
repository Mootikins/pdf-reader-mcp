# Multi-Runtime Support

This PDF Reader MCP server supports multiple JavaScript runtimes for maximum flexibility and performance.

## Supported Runtimes

### ✅ Node.js (Primary)

- **Version**: >=22.0.0
- **Status**: Fully supported
- **Usage**: `npm start` or `node dist/index.js`

### ✅ Bun (Recommended for Development)

- **Version**: >=1.0.0
- **Status**: Fully supported
- **Usage**: `bun run src/index.ts` or `npm run start:bun`
- **Benefits**: Faster startup, built-in TypeScript support

### ⚠️ Deno (Experimental)

- **Version**: >=1.0.0
- **Status**: Experimental support
- **Usage**: `deno run --allow-read --allow-net --allow-env src/index.ts` or `npm run start:deno`
- **Note**: Requires additional permissions for file system access

## Installation & Usage

### Node.js

```bash
npm install @mootikins/pdf-reader-mcp
npx @mootikins/pdf-reader-mcp
```

### Bun

```bash
bun add @mootikins/pdf-reader-mcp
bunx @mootikins/pdf-reader-mcp
```

### Deno

```bash
deno install --allow-read --allow-net --allow-env @mootikins/pdf-reader-mcp
```

## Runtime-Specific Features

### Automatic Detection

The server automatically detects the runtime and adapts its behavior:

- File system operations use runtime-appropriate APIs
- Path resolution works across all platforms
- Command line argument parsing is runtime-agnostic

### Performance Characteristics

- **Node.js**: Stable, mature, extensive ecosystem
- **Bun**: Fastest startup, excellent TypeScript support
- **Deno**: Secure by default, modern APIs

## Configuration Files

### Bun Configuration (`bunfig.toml`)

```toml
[install]
registry = "https://registry.npmjs.org/"

[install.cache]
directory = ".bun"
```

### Deno Configuration (`deno.json`)

```json
{
  "imports": {
    "@modelcontextprotocol/sdk": "npm:@modelcontextprotocol/sdk@^1.18.0",
    "pdfjs-dist": "npm:pdfjs-dist@^5.4.149",
    "zod": "npm:zod@^3.24.2"
  },
  "tasks": {
    "start": "deno run --allow-read --allow-net --allow-env src/index.ts"
  }
}
```

## Development

### Running Tests

```bash
# Node.js
npm test

# Bun
bun test

# Deno
deno test --allow-read --allow-net --allow-env
```

### Building

```bash
# Node.js
npm run build

# Bun
bun run build

# Deno
deno compile --allow-read --allow-net --allow-env src/index.ts
```

## Troubleshooting

### Common Issues

1. **Deno Permissions**: Ensure you grant the necessary permissions:
   - `--allow-read`: For reading PDF files
   - `--allow-net`: For downloading remote PDFs
   - `--allow-env`: For environment variables

2. **Bun Compatibility**: Some Node.js modules might need polyfills. The server includes compatibility layers.

3. **Path Resolution**: All runtimes use the same path resolution logic for consistency.

### Getting Help

- Check the [main README](./README.md) for general usage
- Review runtime-specific documentation
- Open an issue for runtime-specific problems

## Contributing

When adding new features, ensure compatibility across all supported runtimes:

1. Use the runtime compatibility layer in `src/utils/runtime.ts`
2. Test with all three runtimes
3. Update this documentation if needed
