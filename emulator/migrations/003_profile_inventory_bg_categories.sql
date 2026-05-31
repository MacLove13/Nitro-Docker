-- Migration 003: add background categories + ensure inventory quantity default
-- website_profile_catalogues_cats already supports any type via its 'type' column.
-- This migration just seeds example background categories and fixes defaults.

ALTER TABLE `website_profile_inventories`
    MODIFY COLUMN `quantity` INT NOT NULL DEFAULT 1;

-- Insert a default background category if none exist for type 'b'
INSERT IGNORE INTO `website_profile_catalogues_cats` (`type`, `name`)
SELECT 'b', 'Backgrounds' FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM `website_profile_catalogues_cats` WHERE `type` = 'b'
);
