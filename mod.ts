/**
 * Deno libclang wrapper
 *
 * FFI bindings for libclang - the C API for the Clang compiler
 */

// Re-export high-level API
export * from "./src/libclang.ts";

// Re-export FFI types
export * from "./src/ffi/types.ts";
