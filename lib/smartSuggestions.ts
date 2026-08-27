// Rule-based (non-AI) suggestions. Keyword lists cover English + common
// Roman Urdu/Hindi spellings since MindVault's users mix both.
// No network calls, no models — pure local keyword matching.

const TAG_RULES: { tag: string; keywords: string[] }[] = [
  { tag: 'Work', keywords: ['meeting', 'project', 'client', 'deadline', 'office', 'boss', 'presentation', 'report', 'task', 'mulaqat', 'kaam', 'kam'] },
  { tag: 'Study', keywords: ['exam', 'homework', 'lecture', 'assignment', 'class', 'university', 'college', 'parhai', 'parhna', 'imtihan', 'test', 'syllabus'] },
  { tag: 'Health', keywords: ['doctor', 'hospital', 'medicine', 'sick', 'appointment', 'dawa', 'dawai', 'bimar', 'checkup', 'clinic'] },
  { tag: 'Finance', keywords: ['payment', 'invoice', 'loan', 'udhaar', 'udhar', 'bill', 'salary', 'tankhwa', 'paisa', 'paisay', 'rupees', 'kharch', 'kharcha'] },
  { tag: 'Shopping', keywords: ['buy', 'purchase', 'shop', 'kharido', 'kharidna', 'bazar', 'market', 'order', 'mall'] },
  { tag: 'Travel', keywords: ['trip', 'flight', 'ticket', 'hotel', 'safar', 'travel', 'booking', 'airport'] },
  { tag: 'Family', keywords: ['family', 'ghar', 'wife', 'husband', 'bacha', 'bachay', 'mom', 'dad', 'ammi', 'abbu'] },
  { tag: 'Urgent', keywords: ['urgent', 'asap', 'jaldi', 'emergency', 'important', 'zaroori', 'zaruri'] },
  { tag: 'Ideas', keywords: ['idea', 'brainstorm', 'concept', 'socha', 'plan', 'khayal'] },
];

const CATEGORY_RULES: { category: string; keywords: string[] }[] = [
  { category: 'Food', keywords: ['food', 'restaurant', 'khana', 'lunch', 'dinner', 'breakfast', 'nashta', 'dhaba', 'chai', 'hotel'] },
  { category: 'Transport', keywords: ['petrol', 'diesel', 'fuel', 'uber', 'careem', 'rickshaw', 'bus', 'taxi', 'gari', 'gaari', 'transport', 'ride', 'fare'] },
  { category: 'Utilities', keywords: ['electricity', 'bijli', 'gas bill', 'water bill', 'pani bill', 'internet', 'wifi', 'phone bill', 'utility'] },
  { category: 'Health', keywords: ['medicine', 'doctor', 'hospital', 'dawa', 'dawai', 'clinic', 'checkup'] },
  { category: 'Shopping', keywords: ['clothes', 'kapre', 'shopping', 'mall', 'shoes', 'jeans'] },
  { category: 'Rent', keywords: ['rent', 'kiraya', 'house rent'] },
  { category: 'Education', keywords: ['school', 'fees', 'fee', 'tuition', 'college', 'kitaab', 'books', 'university'] },
  { category: 'Groceries', keywords: ['grocery', 'groceries', 'kirana', 'sabzi', 'vegetables', 'atta', 'chawal', 'rice'] },
];

function matchRules<T extends { keywords: string[] }>(text: string, rules: T[]): T[] {
  const lower = text.toLowerCase();
  return rules.filter(rule => rule.keywords.some(kw => lower.includes(kw)));
}

/** Suggests up to 3 tags for a note based on its title/description text. */
export function suggestNoteTags(title: string, description: string): string[] {
  const combined = `${title} ${description}`.trim();
  if (combined.length < 3) return [];
  return matchRules(combined, TAG_RULES).map(r => r.tag).slice(0, 3);
}

/** Suggests a single expense category from free-text (e.g. the ledger note field). */
export function suggestExpenseCategory(text: string): string | null {
  if (!text || text.trim().length < 3) return null;
  const matches = matchRules(text, CATEGORY_RULES);
  return matches.length > 0 ? matches[0].category : null;
}
