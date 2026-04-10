-- Zurynn Book Keeper — Initial Schema
-- Run with: npm run db:migrate

-- Auth -----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `email_verified` BOOLEAN NOT NULL DEFAULT FALSE,
  `verification_token` VARCHAR(255),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS `user_roles` (
  `user_id` INT NOT NULL,
  `role_id` INT NOT NULL,
  `company_id` INT NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`)
);

CREATE TABLE IF NOT EXISTS `sessions` (
  `id` VARCHAR(36) PRIMARY KEY,
  `user_id` INT NOT NULL,
  `refresh_token` VARCHAR(512) NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);

CREATE TABLE IF NOT EXISTS `password_resets` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `used_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);

-- Company --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `companies` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `address` TEXT,
  `phone` VARCHAR(50),
  `email` VARCHAR(255),
  `website` VARCHAR(255),
  `currency` VARCHAR(10) NOT NULL DEFAULT 'USD',
  `fiscal_year_start` VARCHAR(10) NOT NULL DEFAULT '01-01',
  `industry` VARCHAR(100),
  `logo_url` VARCHAR(500),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `company_users` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `company_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'staff',
  `invited_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `accepted_at` TIMESTAMP NULL,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);

CREATE TABLE IF NOT EXISTS `fiscal_years` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `company_id` INT NOT NULL,
  `start_date` VARCHAR(20) NOT NULL,
  `end_date` VARCHAR(20) NOT NULL,
  `closed` BOOLEAN NOT NULL DEFAULT FALSE,
  `closed_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`)
);

CREATE TABLE IF NOT EXISTS `tax_settings` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `company_id` INT NOT NULL,
  `tax_name` VARCHAR(100) NOT NULL,
  `tax_rate` DECIMAL(5,4) NOT NULL,
  `applies_to` VARCHAR(50) NOT NULL DEFAULT 'both',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`)
);

-- Chart of Accounts ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS `account_types` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL UNIQUE,
  `normal_balance` VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS `accounts` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `company_id` INT NOT NULL,
  `account_type_id` INT NOT NULL,
  `parent_id` INT NULL,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `is_system` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`),
  FOREIGN KEY (`account_type_id`) REFERENCES `account_types`(`id`)
);

-- Ledger ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `journal_entries` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `company_id` INT NOT NULL,
  `date` VARCHAR(20) NOT NULL,
  `description` TEXT NOT NULL,
  `reference` VARCHAR(100),
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
  `reversal_of_id` INT NULL,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
);

CREATE TABLE IF NOT EXISTS `journal_entry_lines` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `journal_entry_id` INT NOT NULL,
  `account_id` INT NOT NULL,
  `debit` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `credit` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `memo` TEXT,
  FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`),
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`)
);

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `company_id` INT NULL,
  `user_id` INT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(100) NOT NULL,
  `entity_id` VARCHAR(100),
  `old_value` TEXT,
  `new_value` TEXT,
  `ip_address` VARCHAR(45),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);

-- Invoicing ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `company_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255),
  `phone` VARCHAR(50),
  `address` TEXT,
  `city` VARCHAR(100),
  `state` VARCHAR(100),
  `country` VARCHAR(100) DEFAULT 'US',
  `currency` VARCHAR(10) DEFAULT 'USD',
  `balance_due` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `notes` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`)
);

CREATE TABLE IF NOT EXISTS `invoices` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `company_id` INT NOT NULL,
  `customer_id` INT NOT NULL,
  `invoice_number` VARCHAR(50) NOT NULL,
  `date` VARCHAR(20) NOT NULL,
  `due_date` VARCHAR(20) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
  `subtotal` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `tax_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `total` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `amount_paid` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `notes` TEXT,
  `terms` TEXT,
  `journal_entry_id` INT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`),
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`)
);

CREATE TABLE IF NOT EXISTS `invoice_items` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `invoice_id` INT NOT NULL,
  `description` TEXT NOT NULL,
  `quantity` DECIMAL(10,2) NOT NULL DEFAULT '1.00',
  `unit_price` DECIMAL(15,2) NOT NULL,
  `tax_rate` DECIMAL(5,4) NOT NULL DEFAULT '0.0000',
  `amount` DECIMAL(15,2) NOT NULL,
  FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`)
);

CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `company_id` INT NOT NULL,
  `invoice_id` INT NOT NULL,
  `date` VARCHAR(20) NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `method` VARCHAR(20) NOT NULL DEFAULT 'bank',
  `reference` VARCHAR(100),
  `notes` TEXT,
  `journal_entry_id` INT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`),
  FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`),
  FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`)
);

-- Billing --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `vendors` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `company_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255),
  `phone` VARCHAR(50),
  `address` TEXT,
  `city` VARCHAR(100),
  `state` VARCHAR(100),
  `country` VARCHAR(100) DEFAULT 'US',
  `balance_owed` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `notes` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`)
);

CREATE TABLE IF NOT EXISTS `bills` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `company_id` INT NOT NULL,
  `vendor_id` INT NOT NULL,
  `bill_number` VARCHAR(50) NOT NULL,
  `date` VARCHAR(20) NOT NULL,
  `due_date` VARCHAR(20) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
  `subtotal` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `tax_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `total` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `amount_paid` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `notes` TEXT,
  `journal_entry_id` INT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`),
  FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`)
);

CREATE TABLE IF NOT EXISTS `bill_items` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `bill_id` INT NOT NULL,
  `description` TEXT NOT NULL,
  `quantity` DECIMAL(10,2) NOT NULL DEFAULT '1.00',
  `unit_price` DECIMAL(15,2) NOT NULL,
  `tax_rate` DECIMAL(5,4) NOT NULL DEFAULT '0.0000',
  `amount` DECIMAL(15,2) NOT NULL,
  FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`)
);

CREATE TABLE IF NOT EXISTS `bill_payments` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `company_id` INT NOT NULL,
  `bill_id` INT NOT NULL,
  `date` VARCHAR(20) NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `method` VARCHAR(20) NOT NULL DEFAULT 'bank',
  `reference` VARCHAR(100),
  `notes` TEXT,
  `journal_entry_id` INT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`),
  FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`),
  FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`)
);

-- Banking --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `bank_accounts` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `company_id` INT NOT NULL,
  `account_id` INT NULL,
  `name` VARCHAR(255) NOT NULL,
  `bank_name` VARCHAR(255),
  `account_number` VARCHAR(50),
  `routing_number` VARCHAR(20),
  `current_balance` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`),
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`)
);

CREATE TABLE IF NOT EXISTS `bank_transactions` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `bank_account_id` INT NOT NULL,
  `date` VARCHAR(20) NOT NULL,
  `description` TEXT NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `type` VARCHAR(10) NOT NULL,
  `reconciled` BOOLEAN NOT NULL DEFAULT FALSE,
  `matched_journal_entry_id` INT NULL,
  `imported_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`),
  FOREIGN KEY (`matched_journal_entry_id`) REFERENCES `journal_entries`(`id`)
);

CREATE TABLE IF NOT EXISTS `reconciliations` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `bank_account_id` INT NOT NULL,
  `statement_date` VARCHAR(20) NOT NULL,
  `statement_balance` DECIMAL(15,2) NOT NULL,
  `reconciled_balance` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `status` VARCHAR(20) NOT NULL DEFAULT 'open',
  `completed_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`)
);

-- Automation -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `recurring_templates` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `company_id` INT NOT NULL,
  `type` VARCHAR(20) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `frequency` VARCHAR(20) NOT NULL,
  `next_run_at` TIMESTAMP NOT NULL,
  `template_data` JSON NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`)
);

CREATE TABLE IF NOT EXISTS `auto_categorization_rules` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `company_id` INT NOT NULL,
  `keyword` VARCHAR(255) NOT NULL,
  `account_id` INT NOT NULL,
  `priority` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`),
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`)
);
