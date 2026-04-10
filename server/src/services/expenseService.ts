import { Decimal } from 'decimal.js';
import { AppError } from '../middlewares/errorHandler';
import { findAccountById } from '../repositories/accountRepository';
import {
  findExpenseWithLines,
  findTaxCodeById,
  updateExpensePosted,
  updateExpenseVoided,
} from '../repositories/expenseRepository';
import { postTransaction, reverseTransaction } from './ledgerService';
import { JournalLine } from '../utils/ledgerEngine';

/**
 * Posts a draft expense:
 * 1. Validates accounts and status
 * 2. Constructs GST/HST-aware journal lines
 * 3. Delegates to postTransaction()
 * 4. Updates expense status to 'posted'
 */
export async function postExpense(expenseId: number, companyId: number, userId: number): Promise<void> {
  const expense = await findExpenseWithLines(expenseId, companyId);
  if (!expense) throw new AppError(404, 'Expense not found', 'NOT_FOUND');
  if (expense.status !== 'draft') throw new AppError(400, 'Only draft expenses can be posted', 'NOT_DRAFT');
  if (expense.lines.length === 0) throw new AppError(400, 'Cannot post expense with no line items', 'NO_LINES');

  // Validate payment account is an Asset type
  const paymentAccount = await findAccountById(expense.paymentAccountId, companyId);
  if (!paymentAccount) throw new AppError(400, 'Payment account not found', 'INVALID_ACCOUNT');
  if (paymentAccount.typeName !== 'Asset') {
    throw new AppError(400, `Payment account must be an Asset type; "${paymentAccount.name}" is ${paymentAccount.typeName}`, 'INVALID_PAYMENT_ACCOUNT');
  }

  const journalLines: JournalLine[] = [];
  let totalRecoverableTax = new Decimal(0);
  let recoverableAccountId: number | null = null;

  for (const line of expense.lines) {
    // Validate each expense account is Expense type
    const expenseAccount = await findAccountById(line.expenseAccountId, companyId);
    if (!expenseAccount) throw new AppError(400, 'Expense account not found on a line item', 'INVALID_ACCOUNT');
    if (expenseAccount.typeName !== 'Expense') {
      throw new AppError(400, `Account "${expenseAccount.name}" must be an Expense type`, 'INVALID_EXPENSE_ACCOUNT');
    }

    let lineDebit = new Decimal(line.amount);

    if (line.taxCodeId && new Decimal(line.taxAmount).greaterThan(0)) {
      const taxCode = await findTaxCodeById(line.taxCodeId, companyId);
      if (!taxCode) throw new AppError(400, 'Tax code not found', 'INVALID_TAX_CODE');

      const lineTax = new Decimal(line.taxAmount);
      const recoverablePercent = new Decimal(taxCode.recoverablePercentage ?? '1.0000');
      const recoverableTax = lineTax.times(recoverablePercent).toDecimalPlaces(2);
      const nonRecoverableTax = lineTax.minus(recoverableTax);

      // Non-recoverable portion is absorbed into the expense debit
      if (nonRecoverableTax.greaterThan(0)) {
        lineDebit = lineDebit.plus(nonRecoverableTax);
      }

      // Accumulate recoverable tax — all goes to one debit line at the end
      if (recoverableTax.greaterThan(0)) {
        totalRecoverableTax = totalRecoverableTax.plus(recoverableTax);
        if (!recoverableAccountId && taxCode.recoverableAccountId) {
          recoverableAccountId = taxCode.recoverableAccountId;
        }
      }
    }

    journalLines.push({
      accountId: line.expenseAccountId,
      debit: lineDebit.toFixed(2),
      credit: '0.00',
      memo: line.description,
    });
  }

  // Single debit line for all recoverable GST/HST
  if (totalRecoverableTax.greaterThan(0) && recoverableAccountId) {
    journalLines.push({
      accountId: recoverableAccountId,
      debit: totalRecoverableTax.toFixed(2),
      credit: '0.00',
      memo: 'GST/HST Recoverable',
    });
  }

  // Credit payment account for the full total (subtotal + all tax)
  journalLines.push({
    accountId: expense.paymentAccountId,
    debit: '0.00',
    credit: new Decimal(expense.total).toFixed(2),
    memo: expense.description,
  });

  const jeId = await postTransaction({
    companyId,
    date: expense.date,
    description: expense.description,
    reference: expense.expenseNumber,
    lines: journalLines,
    createdBy: userId,
  });

  await updateExpensePosted(expenseId, companyId, jeId);
}

/**
 * Voids a posted expense by creating a reversing journal entry,
 * then marks the expense as voided.
 */
export async function voidExpense(expenseId: number, companyId: number, userId: number): Promise<void> {
  const expense = await findExpenseWithLines(expenseId, companyId);
  if (!expense) throw new AppError(404, 'Expense not found', 'NOT_FOUND');
  if (expense.status !== 'posted') throw new AppError(400, 'Only posted expenses can be voided', 'NOT_POSTED');
  if (!expense.journalEntryId) throw new AppError(500, 'Posted expense has no linked journal entry', 'NO_JOURNAL');

  await reverseTransaction(expense.journalEntryId, {
    companyId,
    date: new Date().toISOString().slice(0, 10),
    description: `VOID: ${expense.description}`,
    reference: `VOID-${expense.expenseNumber}`,
    createdBy: userId,
  });

  await updateExpenseVoided(expenseId, companyId);
}
