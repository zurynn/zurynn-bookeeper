import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';
import { validateJournalEntry } from '../utils/ledgerEngine';
import {
  listJournalEntries,
  findJournalEntryWithLines,
  createJournalEntryWithLines,
  updateJournalEntryHeader,
  replaceJournalLines,
  postJournalEntry,
  createReversalEntry,
  deleteJournalEntry,
} from '../repositories/journalRepository';

const lineSchema = z.object({
  accountId: z.number().int().positive(),
  debit: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0.00'),
  credit: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0.00'),
  memo: z.string().max(500).optional(),
});

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  description: z.string().min(1).max(500),
  reference: z.string().max(100).optional(),
  lines: z.array(lineSchema).min(2, 'Must have at least 2 lines'),
});

const updateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().min(1).max(500).optional(),
  reference: z.string().max(100).optional(),
  lines: z.array(lineSchema).min(2).optional(),
});

// GET /api/journal
export async function getJournalEntries(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
    const result = await listJournalEntries(req.user!.companyId!, page, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

// GET /api/journal/:id
export async function getJournalEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const entry = await findJournalEntryWithLines(id, req.user!.companyId!);
    if (!entry) throw new AppError(404, 'Journal entry not found', 'NOT_FOUND');
    res.json({ success: true, data: { entry } });
  } catch (error) {
    next(error);
  }
}

// POST /api/journal
export async function createEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const { date, description, reference, lines } = createSchema.parse(req.body);
    validateJournalEntry(lines);

    const id = await createJournalEntryWithLines(
      { companyId: req.user!.companyId!, date, description, reference, createdBy: req.user!.userId },
      lines
    );

    const entry = await findJournalEntryWithLines(id, req.user!.companyId!);
    res.status(201).json({ success: true, data: { entry } });
  } catch (error) {
    // Surface ledger validation errors as 400
    if ((error as any).name === 'LedgerError') {
      return next(new AppError(400, (error as Error).message, 'LEDGER_ERROR'));
    }
    next(error);
  }
}

// PUT /api/journal/:id
export async function updateEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const companyId = req.user!.companyId!;

    const existing = await findJournalEntryWithLines(id, companyId);
    if (!existing) throw new AppError(404, 'Journal entry not found', 'NOT_FOUND');
    if (existing.status !== 'draft') throw new AppError(400, 'Only draft entries can be edited', 'NOT_DRAFT');

    const { lines, ...headerData } = updateSchema.parse(req.body);

    if (Object.keys(headerData).length > 0) {
      await updateJournalEntryHeader(id, companyId, headerData);
    }

    if (lines) {
      validateJournalEntry(lines);
      await replaceJournalLines(id, lines);
    }

    const updated = await findJournalEntryWithLines(id, companyId);
    res.json({ success: true, data: { entry: updated } });
  } catch (error) {
    if ((error as any).name === 'LedgerError') {
      return next(new AppError(400, (error as Error).message, 'LEDGER_ERROR'));
    }
    next(error);
  }
}

// POST /api/journal/:id/post
export async function postEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const companyId = req.user!.companyId!;

    const entry = await findJournalEntryWithLines(id, companyId);
    if (!entry) throw new AppError(404, 'Journal entry not found', 'NOT_FOUND');
    if (entry.status !== 'draft') throw new AppError(400, 'Entry is already posted', 'ALREADY_POSTED');
    if (entry.lines.length < 2) throw new AppError(400, 'Cannot post entry with no lines', 'NO_LINES');

    // Re-validate balance before posting
    validateJournalEntry(entry.lines.map((l) => ({ accountId: l.accountId, debit: l.debit, credit: l.credit })));

    await postJournalEntry(id, companyId);
    res.json({ success: true, message: 'Journal entry posted.' });
  } catch (error) {
    if ((error as any).name === 'LedgerError') {
      return next(new AppError(400, (error as Error).message, 'LEDGER_ERROR'));
    }
    next(error);
  }
}

// POST /api/journal/:id/reverse
export async function reverseEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const companyId = req.user!.companyId!;
    const { date } = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.body);

    const reversalId = await createReversalEntry(id, companyId, req.user!.userId, date);
    const reversal = await findJournalEntryWithLines(reversalId, companyId);
    res.status(201).json({ success: true, data: { entry: reversal } });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/journal/:id
export async function removeEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    await deleteJournalEntry(id, req.user!.companyId!);
    res.json({ success: true, message: 'Journal entry deleted.' });
  } catch (error) {
    next(error);
  }
}
