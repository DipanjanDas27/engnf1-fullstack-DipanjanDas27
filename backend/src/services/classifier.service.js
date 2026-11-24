/**
 * Deterministic Auto-Triage Classifier (Rule T-B1).
 * Pure functional module — zero external dependencies.
 * Keyword matching is case-insensitive and operates on combined subject + body text.
 */

const CATEGORY_RULES = [
  { keywords: ['refund', 'invoice', 'charge', 'payment'], category: 'BILLING' },
  { keywords: ['password', '2fa', 'sign in', 'locked out', 'login'], category: 'LOGIN' },
  { keywords: ['package', 'arrived', 'shipping', 'tracking', 'delivery'], category: 'DELIVERY' },
  { keywords: ['crash', 'error', '500', 'exception', 'broken'], category: 'BUG' }
];

const PRIORITY_RULES = [
  { keywords: ['urgent', 'production down', 'locked out'], priority: 'URGENT' },
  { keywords: ['error', 'refund', 'not arrived'], priority: 'HIGH' }
];

/**
 * Classifies a ticket into a category and priority based on keyword rules.
 *
 * @param {string} subject - Ticket subject line
 * @param {string} body    - Ticket body text
 * @returns {{ category: string, priority: string }}
 */
export const classifyTicket = (subject = '', body = '') => {
  const combined = `${subject} ${body}`.toLowerCase();

  // Category — first match wins
  let category = 'FEATURE_REQUEST';
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => combined.includes(kw))) {
      category = rule.category;
      break;
    }
  }

  // Priority — first match wins
  let priority = 'MEDIUM';
  for (const rule of PRIORITY_RULES) {
    if (rule.keywords.some((kw) => combined.includes(kw))) {
      priority = rule.priority;
      break;
    }
  }

  return { category, priority };
};
