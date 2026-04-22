-- Simple transactions table for the simplified bookkeeping app
CREATE TABLE IF NOT EXISTS `simple_transactions` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `company_id` INT NOT NULL,
  `type` VARCHAR(10) NOT NULL,
  `date` VARCHAR(20) NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `account_code` VARCHAR(20) NOT NULL,
  `journal_entry_id` INT NULL,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`),
  FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
);
