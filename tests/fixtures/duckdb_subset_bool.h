/*
 * Subset of DuckDB v1.5.5 duckdb.h containing every function declaration whose
 * return type is `_Bool` (i.e. `bool` from <stdbool.h>), plus a single
 * contrast declaration whose return type is `int`.
 *
 * The header is parsed only for AST traversal tests - the typedef shapes are
 * stubs that match the libclang parser's expectations.
 */

#ifndef DUCKDB_SUBSET_BOOL_H
#define DUCKDB_SUBSET_BOOL_H

#include <stdbool.h>
#include <stdint.h>

typedef uint64_t idx_t;

typedef struct duckdb_result {
  int _;
} duckdb_result;

typedef struct duckdb_value {
  int _;
} duckdb_value;

typedef struct duckdb_error_data {
  int _;
} duckdb_error_data;

typedef struct duckdb_string_t {
  int _;
} duckdb_string_t;

typedef struct duckdb_date {
  int _;
} duckdb_date;

typedef struct duckdb_timestamp {
  int _;
} duckdb_timestamp;

typedef struct duckdb_timestamp_s {
  int _;
} duckdb_timestamp_s;

typedef struct duckdb_timestamp_ms {
  int _;
} duckdb_timestamp_ms;

typedef struct duckdb_timestamp_ns {
  int _;
} duckdb_timestamp_ns;

typedef struct duckdb_pending_state {
  int _;
} duckdb_pending_state;

typedef struct duckdb_task_state {
  int _;
} duckdb_task_state;

typedef struct duckdb_connection {
  int _;
} duckdb_connection;

typedef struct duckdb_expression {
  int _;
} duckdb_expression;

bool duckdb_error_data_has_error(duckdb_error_data error_data);
bool duckdb_result_is_streaming(duckdb_result result);
bool duckdb_value_boolean(duckdb_result *result, idx_t col, idx_t row);
bool duckdb_value_is_null(duckdb_result *result, idx_t col, idx_t row);
bool duckdb_get_bool(duckdb_value val);
bool duckdb_string_is_inlined(duckdb_string_t string);
bool duckdb_is_finite_date(duckdb_date date);
bool duckdb_is_finite_timestamp(duckdb_timestamp ts);
bool duckdb_is_finite_timestamp_s(duckdb_timestamp_s ts);
bool duckdb_is_finite_timestamp_ms(duckdb_timestamp_ms ts);
bool duckdb_is_finite_timestamp_ns(duckdb_timestamp_ns ts);
bool duckdb_pending_execution_is_finished(duckdb_pending_state pending_state);
bool duckdb_task_state_is_finished(duckdb_task_state state);
bool duckdb_execution_is_finished(duckdb_connection con);
bool duckdb_expression_is_foldable(duckdb_expression expr);

int duckdb_control_int_return(int x);
bool duckdb_control_bool_return(bool b);

#endif