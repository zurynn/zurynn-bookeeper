import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { AppError } from '../middlewares/errorHandler';
import { findBillWithItems, listBillAttachments, createBillAttachment, findBillAttachment, deleteBillAttachment } from '../repositories/billRepository';

const UPLOAD_DIR = path.join(__dirname, '../../uploads/bills');

export async function uploadAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const billId = parseInt(req.params.id, 10);
    const companyId = req.user!.companyId!;

    if (!req.file) throw new AppError(400, 'No file uploaded', 'NO_FILE');

    const bill = await findBillWithItems(billId, companyId);
    if (!bill) {
      // Remove the already-saved file since the bill doesn't belong to this company
      fs.unlink(req.file.path, () => {});
      throw new AppError(404, 'Bill not found', 'NOT_FOUND');
    }

    const id = await createBillAttachment({
      billId,
      companyId,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });

    res.status(201).json({
      success: true,
      data: {
        id,
        billId,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (e) { next(e); }
}

export async function getAttachments(req: Request, res: Response, next: NextFunction) {
  try {
    const billId = parseInt(req.params.id, 10);
    const companyId = req.user!.companyId!;
    const attachments = await listBillAttachments(billId, companyId);
    res.json({ success: true, data: { attachments } });
  } catch (e) { next(e); }
}

export async function deleteAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const attachmentId = parseInt(req.params.attachmentId, 10);
    const companyId = req.user!.companyId!;

    const attachment = await findBillAttachment(attachmentId, companyId);
    if (!attachment) throw new AppError(404, 'Attachment not found', 'NOT_FOUND');

    const filePath = path.join(UPLOAD_DIR, attachment.storedName);
    fs.unlink(filePath, () => {}); // best-effort; don't block on disk error

    await deleteBillAttachment(attachmentId);

    res.json({ success: true });
  } catch (e) { next(e); }
}
