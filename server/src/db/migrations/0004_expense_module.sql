-- Expense Module: extend tax_settings + add expense tables

ALTER TABLE `tax_settings`
  ADD COLUMN `recoverable_percentage` DECIMAL(5,4) NOT NULL DEFAULT '1.0000' AFTER `tax_rate`,
  ADD COLUMN `recoverable_account_id` INT NULL AFTER `recoverable_percentage`,
  ADD COLUMN `liability_account_id` INT NULL AFTER `recoverable_account_id`,
  ADD CONSTRAINT `fk_tax_settings_recoverable_account` FOREIGN KEY (`recoverable_account_id`) REFERENCES `accounts` (`id`),
  ADD CONSTRAINT `fk_tax_settings_liability_account` FOREIGN KEY (`liability_account_id`) REFERENCES `accounts` (`id`);

CREATE TABLE IF NOT EXISTS `expenses` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `company_id` INT NOT NULL,
  `expense_number` VARCHAR(50) NOT NULL,
  `vendor_id` INT NULL,
  `payment_account_id` INT NOT NULL,
  `date` VARCHAR(20) NOT NULL,
  `description` TEXT NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
  `subtotal` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `tax_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `total` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `journal_entry_id` INT NULL,
  `posted_at` TIMESTAMP NULL,
  `voided_at` TIMESTAMP NULL,
  `notes` TEXT NULL,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `idx_expenses_company_id` (`company_id`),
  KEY `idx_expenses_status` (`status`),
  CONSTRAINT `fk_expenses_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),
  CONSTRAINT `fk_expenses_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`),
  CONSTRAINT `fk_expenses_payment_account` FOREIGN KEY (`payment_account_id`) REFERENCES `accounts` (`id`),
  CONSTRAINT `fk_expenses_journal_entry` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries` (`id`),
  CONSTRAINT `fk_expenses_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
);

CREATE TABLE IF NOT EXISTS `expense_lines` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `expense_id` INT NOT NULL,
  `expense_account_id` INT NOT NULL,
  `description` TEXT NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `tax_code_id` INT NULL,
  `tax_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `idx_expense_lines_expense_id` (`expense_id`),
  CONSTRAINT `fk_expense_lines_expense` FOREIGN KEY (`expense_id`) REFERENCES `expenses` (`id`),
  CONSTRAINT `fk_expense_lines_account` FOREIGN KEY (`expense_account_id`) REFERENCES `accounts` (`id`),
  CONSTRAINT `fk_expense_lines_tax_code` FOREIGN KEY (`tax_code_id`) REFERENCES `tax_settings` (`id`)
);

CREATE TABLE IF NOT EXISTS `expense_attachments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `expense_id` INT NOT NULL,
  `company_id` INT NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `stored_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `size` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_expense_attachments_expense_id` (`expense_id`),
  CONSTRAINT `fk_expense_attachments_expense` FOREIGN KEY (`expense_id`) REFERENCES `expenses` (`id`),
  CONSTRAINT `fk_expense_attachments_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
);
