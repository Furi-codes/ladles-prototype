import type { PostgrestResponse } from '@supabase/supabase-js';

/** Shared count-based paging for client and server queries. Callers must order by a unique key. */
export async function fetchAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<PostgrestResponse<T>>): Promise<PostgrestResponse<T>> {
  const rows: T[] = [];
  let expectedCount: number | undefined;
  for (;;) {
    const result = await fetchPage(rows.length, rows.length + 499);
    if (result.error) return result;
    const { data, count } = result;
    const incomplete = count == null || !Number.isInteger(count) || count < 0;
    if (incomplete || (expectedCount !== undefined && count !== expectedCount) ||
      !Array.isArray(data) || rows.length + data.length > count! || (!data.length && rows.length < count!)) {
      return { success: false, data: null, count: null, status: 500, statusText: 'Incomplete data', error: {
        name: 'PaginationError', code: 'VMS_INCOMPLETE', details: '', hint: 'Refresh and retry.',
        message: incomplete ? 'The server did not return a complete row count. Please retry.' : 'Data changed while loading. Refresh to load complete data.',
        toJSON() { return { name: this.name, message: this.message, code: this.code, details: this.details, hint: this.hint }; },
      } };
    }
    expectedCount = count!;
    rows.push(...data);
    if (rows.length === expectedCount) return { ...result, data: rows };
  }
}

/** Keep IN filters small enough for request URLs, while paging every batch. */
export async function fetchRowsByIds<T>(ids: (string | number)[], fetchPage: (ids: (string | number)[], from: number, to: number) => PromiseLike<PostgrestResponse<T>>): Promise<PostgrestResponse<T>> {
  const uniqueIds = [...new Set(ids)];
  const rows: T[] = [];
  for (let i = 0; i < uniqueIds.length; i += 100) {
    const batch = uniqueIds.slice(i, i + 100);
    const result = await fetchAllPages((from, to) => fetchPage(batch, from, to));
    if (result.error) return result;
    rows.push(...result.data);
  }
  return { success: true, data: rows, error: null, count: rows.length, status: 200, statusText: 'OK' };
}
