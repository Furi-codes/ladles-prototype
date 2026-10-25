/**
 * Converts backend failures into safe messages for the UI.
 * Known technical patterns use the caller's fallback so SQL, schema and internal diagnostic
 * details are not shown to users.
 */

export function isTechnicalMessage(message: string) {
  return /\b(?:sql(?:state)?|pl\/pgsql|postgres(?:ql)?|postgrest|supabase|rpc|rls|pgrst\d*|schema|migration|dba|stack\s*trace)\b/i.test(message)
    || /\b(?:database|query failed|permission denied|row.level security|constraint|invalid input syntax|syntax error|unterminated quoted|duplicate key|deadlock detected|could not serialize|statement timeout|lock timeout|on conflict|too many connections|json object|unexpected token)\b/i.test(message)
    || /\b(?:relation|column|function|operator|table|sequence)\b[^\n]*\bdoes not exist\b/i.test(message)
    || /\b(?:relation|column|function|operator|table|sequence|constraint)\s+["'`\w.]+\s+(?:does not exist|is not defined|not found)/i.test(message)
    || /\b(?:select\s+.+\s+from|insert\s+into|update\s+\S+\s+set|delete\s+from|create\s+(?:or replace\s+)?(?:table|function|policy)|alter\s+table|grant\s+.+\s+on)\b/i.test(message)
    || /(?:^|\n)\s*(?:[{[]|at\s+\S+\s*\([^)]*:\d+)/.test(message)
    || /[{[]\s*"(?:message|code|details|hint|query)"\s*:|\bSELECT\s+(?:\*|\d+)|\$(?:function|body)\$/i.test(message)
    || /\b(?:service_role|secret[_ -]?key|access[_ -]?token|refresh[_ -]?token)\b|https?:\/\/\S+|\b(?:public|corporate_private|notification_private|auth)\.[a-z_]\w*/i.test(message);
}

/** Keep actionable business rules; suppress queries, object dumps, stack traces and internal setup details. */
export function userFacingError(error: unknown, fallback = 'This action could not be completed. Please refresh and try again.'): string {
  const message = typeof error === 'string' ? error : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : '';
  if (error === '' || error === null || error === undefined) return '';
  if (!message.trim() || message.length > 500 || isTechnicalMessage(message)) return fallback;
  return message;
}
