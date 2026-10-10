-- AlterTable
ALTER TABLE `products` ADD COLUMN `base_price` DECIMAL(65, 30) NOT NULL DEFAULT 0.0,
    ADD COLUMN `image_path` VARCHAR(191) NULL;
