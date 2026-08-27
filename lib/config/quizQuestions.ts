// Finance/money-management trivia, relevant to MindVault's audience (shopkeepers,
// budget-conscious users). Kept server-side only so answers can't be read from
// client bundle - the frontend never sees correctIndex until after answering.
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { id: 'q1', question: 'What does "khata" traditionally mean in South Asian shopkeeping?', options: ['A type of loan', 'A credit/debt ledger', 'A cash register', 'A tax receipt'], correctIndex: 1, explanation: 'Khata is a running ledger of credit given to or owed by customers.' },
  { id: 'q2', question: 'What is the "50/30/20 rule" in personal budgeting?', options: ['50% savings, 30% needs, 20% wants', '50% needs, 30% wants, 20% savings', '50% wants, 30% savings, 20% needs', 'It applies only to businesses'], correctIndex: 1, explanation: '50% needs, 30% wants, 20% savings/debt repayment is a common budgeting guideline.' },
  { id: 'q3', question: 'What does "profit margin" measure?', options: ['Total revenue', 'Total cost', 'Profit as a percentage of selling price', 'Profit as a percentage of cost'], correctIndex: 2, explanation: 'Profit margin = (Selling Price - Cost) / Selling Price x 100.' },
  { id: 'q4', question: 'What is compound interest?', options: ['Interest only on the principal', 'Interest on principal + previously earned interest', 'A one-time fee', 'A type of tax'], correctIndex: 1, explanation: 'Compound interest grows because you earn interest on your interest over time.' },
  { id: 'q5', question: 'In an EMI loan, what does EMI stand for?', options: ['Equal Monthly Installment', 'Extended Money Interest', 'Estimated Market Index', 'Early Monthly Investment'], correctIndex: 0, explanation: 'EMI = Equal Monthly Installment, a fixed payment each month covering principal + interest.' },
  { id: 'q6', question: 'What is an "emergency fund" typically meant to cover?', options: ['Luxury purchases', '3-6 months of essential expenses', 'One month of rent only', 'Business investments'], correctIndex: 1, explanation: 'Most financial advisors recommend 3-6 months of essential living expenses saved for emergencies.' },
  { id: 'q7', question: 'What does GST/VAT typically apply to?', options: ['Only imports', 'Goods and services sold', 'Only salaries', 'Only property'], correctIndex: 1, explanation: 'GST/VAT is a consumption tax applied to the sale of goods and services.' },
  { id: 'q8', question: 'What is "inventory turnover" a measure of?', options: ['How fast stock sells and is replaced', 'Total number of products', 'Store foot traffic', 'Employee productivity'], correctIndex: 0, explanation: 'Inventory turnover shows how many times stock is sold and replaced over a period.' },
  { id: 'q9', question: 'What is a common risk of not tracking your udhaar (debts given/owed)?', options: ['Lower taxes', 'Forgetting who owes what, leading to losses', 'Higher interest rates automatically', 'None, it is always safe'], correctIndex: 1, explanation: 'Untracked debts are a leading cause of small business cash-flow problems.' },
  { id: 'q10', question: 'What does "liquidity" mean in personal finance?', options: ['Total net worth', 'How quickly an asset can be converted to cash', 'Amount of debt owed', 'Monthly income'], correctIndex: 1, explanation: 'Liquidity refers to how easily and quickly an asset can be turned into usable cash.' },
];
