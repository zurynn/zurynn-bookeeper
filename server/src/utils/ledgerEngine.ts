import { Decimal } from 'decimal.js';

export interface JournalLine {
  accountId: number;
  debit: string | number;
  credit: string | number;
  memo?: string;
}

export interface ValidatedJournalEntry {
  lines: JournalLine[];
  totalDebits: string;
  totalCredits: string;
}

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerError';
  }
}

export function validateJournalEntry(lines: JournalLine[]): ValidatedJournalEntry {
  if (!lines || lines.length < 2) {
    throw new LedgerError('Journal entry must have at least 2 lines');
  }

  let totalDebits = new Decimal(0);
  let totalCredits = new Decimal(0);

  for (const line of lines) {
    const debit = new Decimal(line.debit || 0);
    const credit = new Decimal(line.credit || 0);

    if (debit.isNegative() || credit.isNegative()) {
      throw new LedgerError('Debit and credit amounts must be non-negative');
    }

    if (debit.greaterThan(0) && credit.greaterThan(0)) {
      throw new LedgerError('A journal line cannot have both debit and credit amounts');
    }

    totalDebits = totalDebits.plus(debit);
    totalCredits = totalCredits.plus(credit);
  }

  if (!totalDebits.equals(totalCredits)) {
    throw new LedgerError(
      `Journal entry is not balanced: debits (${totalDebits.toFixed(2)}) !== credits (${totalCredits.toFixed(2)})`
    );
  }

  if (totalDebits.equals(0)) {
    throw new LedgerError('Journal entry cannot have zero totals');
  }

  return {
    lines,
    totalDebits: totalDebits.toFixed(2),
    totalCredits: totalCredits.toFixed(2),
  };
}

export function calculateBalance(
  accountType: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense',
  totalDebits: Decimal,
  totalCredits: Decimal
): Decimal {
  const normalBalance = ['Asset', 'Expense'].includes(accountType) ? 'debit' : 'credit';
  
  if (normalBalance === 'debit') {
    return totalDebits.minus(totalCredits);
  } else {
    return totalCredits.minus(totalDebits);
  }
}
