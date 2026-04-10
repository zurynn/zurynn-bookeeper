import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';
import * as repo from '../repositories/bankingRepository';

// ─── Bank Accounts ─────────────────────────────────────────────────────────────

export async function getBankAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId!;
    const accounts = await repo.listBankAccounts(companyId);
    res.json({ success: true, data: { bankAccounts: accounts } });
  } catch (e) {
    next(e);
  }
}

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  accountId: z.number().int().optional(),
  openingBalance: z.string().optional(),
});

export async function createBankAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId!;
    const data = createSchema.parse(req.body);
    const account = await repo.createBankAccount(companyId, data);
    res.status(201).json({ success: true, data: { bankAccount: account } });
  } catch (e) {
    next(e);
  }
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
});

export async function updateBankAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId!;
    const id = parseInt(req.params.id);
    const data = updateSchema.parse(req.body);
    const account = await repo.updateBankAccount(id, companyId, data);
    if (!account) throw new AppError(404, 'Bank account not found', 'NOT_FOUND');
    res.json({ success: true, data: { bankAccount: account } });
  } catch (e) {
    next(e);
  }
}

export async function deleteBankAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId!;
    const id = parseInt(req.params.id);
    await repo.deactivateBankAccount(id, companyId);
    res.json({ success: true, data: {} });
  } catch (e) {
    next(e);
  }
}

// ─── Transactions ──────────────────────────────────────────────────────────────

export async function getTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const bankAccountId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const filter = (req.query.filter as 'all' | 'unmatched' | 'unreconciled') || 'all';
    const result = await repo.listTransactions(bankAccountId, page, 50, filter);
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

const txSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1),
  amount: z.string().min(1),
  type: z.enum(['debit', 'credit']),
});

export async function addTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const bankAccountId = parseInt(req.params.id);
    const data = txSchema.parse(req.body);
    const tx = await repo.addTransaction(bankAccountId, data);
    res.status(201).json({ success: true, data: { transaction: tx } });
  } catch (e) {
    next(e);
  }
}

const importSchema = z.object({
  transactions: z.array(txSchema).min(1, 'At least one transaction is required'),
});

export async function importTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const bankAccountId = parseInt(req.params.id);
    const { transactions } = importSchema.parse(req.body);
    const result = await repo.importTransactions(bankAccountId, transactions);
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

export async function matchTx(req: Request, res: Response, next: NextFunction) {
  try {
    const bankAccountId = parseInt(req.params.id);
    const txId = parseInt(req.params.txId);
    const { journalEntryId } = z
      .object({ journalEntryId: z.number().int() })
      .parse(req.body);
    await repo.matchTransaction(txId, bankAccountId, journalEntryId);
    res.json({ success: true, data: {} });
  } catch (e) {
    next(e);
  }
}

export async function unmatchTx(req: Request, res: Response, next: NextFunction) {
  try {
    const bankAccountId = parseInt(req.params.id);
    const txId = parseInt(req.params.txId);
    await repo.unmatchTransaction(txId, bankAccountId);
    res.json({ success: true, data: {} });
  } catch (e) {
    next(e);
  }
}

// ─── Reconciliation ────────────────────────────────────────────────────────────

export async function getReconciliations(req: Request, res: Response, next: NextFunction) {
  try {
    const bankAccountId = parseInt(req.params.id);
    const list = await repo.listReconciliations(bankAccountId);
    res.json({ success: true, data: { reconciliations: list } });
  } catch (e) {
    next(e);
  }
}

export async function getOpenRecon(req: Request, res: Response, next: NextFunction) {
  try {
    const bankAccountId = parseInt(req.params.id);
    const result = await repo.getOpenReconciliation(bankAccountId);
    res.json({ success: true, data: result ?? { reconciliation: null, transactions: [] } });
  } catch (e) {
    next(e);
  }
}

export async function startRecon(req: Request, res: Response, next: NextFunction) {
  try {
    const bankAccountId = parseInt(req.params.id);
    const { statementDate, statementBalance } = z
      .object({
        statementDate: z.string().min(1),
        statementBalance: z.string().min(1),
      })
      .parse(req.body);
    const recon = await repo.startReconciliation(bankAccountId, statementDate, statementBalance);
    res.status(201).json({ success: true, data: { reconciliation: recon } });
  } catch (e) {
    next(e);
  }
}

export async function closeRecon(req: Request, res: Response, next: NextFunction) {
  try {
    const bankAccountId = parseInt(req.params.id);
    const reconId = parseInt(req.params.reconId);
    const { markedTxIds } = z
      .object({ markedTxIds: z.array(z.number().int()) })
      .parse(req.body);
    const recon = await repo.closeReconciliation(reconId, bankAccountId, markedTxIds);
    res.json({ success: true, data: { reconciliation: recon } });
  } catch (e) {
    next(e);
  }
}
