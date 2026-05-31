-- Migration 001: Add sticker shop (My Page)
-- Adds price column to sticker catalogue, creates user inventory table,
-- and registers the housekeeping permission for sticker management.

ALTER TABLE `website_profile_catalogues`
    ADD COLUMN IF NOT EXISTS `price` int(11) NOT NULL DEFAULT 0 AFTER `category`;

CREATE TABLE IF NOT EXISTS `website_profile_inventories` (
  `id`           int(11)      NOT NULL AUTO_INCREMENT,
  `user_id`      int(11)      NOT NULL,
  `catalogue_id` int(11)      NOT NULL,
  `quantity`     int(11)      NOT NULL DEFAULT 1,
  `purchased_at` int(11)      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uq_user_catalogue` (`user_id`, `catalogue_id`)
) ENGINE = InnoDB DEFAULT CHARSET = latin1 ROW_FORMAT = Dynamic;

INSERT IGNORE INTO `website_permissions` (`id`, `name`, `description`)
VALUES (NULL, 'housekeeping_home_stickers', 'Player is able to manage home sticker categories, items and prices');
