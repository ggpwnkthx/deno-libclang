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

## Running Tests

```bash
deno test -A
```

## License

MIT License - see [LICENSE](./LICENSE)
