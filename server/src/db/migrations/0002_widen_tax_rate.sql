-- Widen tax_rate from DECIMAL(5,4) to DECIMAL(6,4) to support double-digit rates (e.g. HST 13)
ALTER TABLE `tax_settings` MODIFY COLUMN `tax_rate` DECIMAL(6,4) NOT NULL;
ALTER TABLE `invoice_items` MODIFY COLUMN `tax_rate` DECIMAL(6,4) NOT NULL DEFAULT '0.0000';
ALTER TABLE `bill_items` MODIFY COLUMN `tax_rate` DECIMAL(6,4) NOT NULL DEFAULT '0.0000';
