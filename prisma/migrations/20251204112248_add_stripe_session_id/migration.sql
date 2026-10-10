/*
  Warnings:

  - A unique constraint covering the columns `[stripe_session_id]` on the table `orders` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `orders` ADD COLUMN `stripe_session_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `orders_stripe_session_id_key` ON `orders`(`stripe_session_id`);
