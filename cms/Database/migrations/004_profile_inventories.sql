-- Migration: add price column to website_profile_catalogues + create website_profile_inventories

ALTER TABLE `website_profile_catalogues`
  ADD COLUMN `price` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `category`;

CREATE TABLE IF NOT EXISTS `website_profile_inventories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `catalogue_id` INT UNSIGNED NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `purchased_at` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_item` (`user_id`, `catalogue_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
