# @ggpwnkthx/libclang

Deno FFI bindings for libclang - parse, analyze, and extract information from
C/C++/Objective-C source code.

[![JSR](https://jsr.io/badges/@ggpwnkthx/libclang)](https://jsr.io/@ggpwnkthx/libclang)

## Prerequisites

- [Deno](https://deno.land/) runtime
- libclang installed on your system:
  - Linux: `apt install libclang-dev` or equivalent
  - macOS: `brew install llvm`
  - Windows: Install LLVM

## Usage

```typescript
import {
  createIndex,
  CXChildVisitResult,
  CXCursorKind,
  disposeIndex,
  disposeTranslationUnit,
  getCursorKindSpelling,
  getCursorSpelling,
  load,
  parseTranslationUnit,
  visitChildren,
} from "@ggpwnkthx/libclang";

// Load libclang (auto-detects platform)
load();

// Create an index
const index = createIndex();
const translationUnit = parseTranslationUnit(index, "path/to/source.c");

// Visit AST nodes
visitChildren(translationUnit, (cursor, _parent) => {
  console.log(
    `${getCursorKindSpelling(getCursorKind(cursor))}: ${
      getCursorSpelling(cursor)
    }`,
  );

  // Continue visiting
  return CXChildVisitResult.Recurse;
});

// Clean up
disposeTranslationUnit(translationUnit);
disposeIndex(index);
```

## API

| Module                         | Description                                  |
| ------------------------------ | -------------------------------------------- |
| `load` / `unload`              | Load/unload the libclang library             |
| `createIndex` / `disposeIndex` | Create/dispose CXIndex (compilation context) |
| `parseTranslationUnit`         | Parse C/C++ source files into AST            |
| `visitChildren`                | Navigate AST nodes with a visitor callback   |
| `getCursor*` functions         | Query cursor (AST node) properties           |
| `getType*` functions           | Query type information                       |
| `getDiagnostics`               | Get compiler diagnostics/errors/warnings     |
| `getFile` / `getLocation`      | Handle source files and locations            |

## Memory Management

This library uses manual memory management via FFI. You **must** dispose of
resources to prevent memory leaks:

```typescript
// Always dispose resources when done
disposeTranslationUnit(translationUnit);
disposeIndex(index);

// If you want to unload libclang entirely
unload();
```

The `parseTranslationUnit` function returns a `_keepAlive` field in the result
that contains native memory buffers. Keep this array in scope for the lifetime
of the translation unit:

```typescript
const result = parseTranslationUnit(index, "file.c");
if (result.translationUnit) {
  // result._keepAlive must remain in scope while using the translation unit
  // You can store it alongside your unit
  const unit = result.translationUnit;
  const keepAlive = result._keepAlive;

  // Use the unit...
  visitChildren(unit, (cursor) => {/* ... */});

  // Dispose when done
  disposeTranslationUnit(unit);
  // keepAlive can now go out of scope
}
```

## Error Handling

Functions may throw or return errors for invalid inputs:

```typescript
// parseTranslationUnit returns error info in result
const result = parseTranslationUnit(index, "nonexistent.c");
if (result.error) {
  console.error("Parse failed:", result.error);
}

// Invalid inputs return results with error messages
const invalidResult = parseTranslationUnit(null, "");
// invalidResult.error will be "Invalid index: CXIndex is null or undefined"
```

## Thread Safety

**Note:** libclang is not thread-safe. Do not share translation units, cursors,
or other libclang objects across threads. Each thread should create its own
index and translation units.

## Running Tests

```bash
deno test --allow-all
```

## Code Quality

```bash
# Lint code
deno lint

# Format code
deno fmt
```

## License

MIT License - see [LICENSE](./LICENSE)
