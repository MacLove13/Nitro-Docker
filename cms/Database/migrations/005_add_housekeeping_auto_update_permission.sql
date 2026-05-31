-- Migration: Add housekeeping_auto_update permission and assign to rank 7
INSERT IGNORE INTO `website_permissions` (`id`, `permission`, `description`)
VALUES (30, 'housekeeping_auto_update', 'Player is able to use the auto-update tool in the housekeeping panel.');

INSERT IGNORE INTO `website_permissions_ranks` (`permission_id`, `rank_id`)
VALUES (30, 7);
