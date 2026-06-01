-- Migration: Add Wired User Variable System
-- This migration adds tables for the Wired User Variable system,
-- which allows per-user variables to be defined and manipulated via Wired effects.

-- Table: wired_variable_definitions
-- Stores the definition of each user variable (name, type, default value, persistence) per room.
CREATE TABLE IF NOT EXISTS `wired_variable_definitions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `room_id` INT NOT NULL,
  `variable_name` VARCHAR(100) NOT NULL,
  `variable_type` VARCHAR(50) NOT NULL DEFAULT 'number',
  `default_value` TEXT NULL,
  `is_persistent` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_room_variable` (`room_id`, `variable_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: wired_user_variable_values
-- Stores the per-user values for each variable, keyed by (room_id, user_id, variable_name).
CREATE TABLE IF NOT EXISTS `wired_user_variable_values` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `room_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `variable_name` VARCHAR(100) NOT NULL,
  `value` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_variable` (`room_id`, `user_id`, `variable_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index to optimize non-persistent variable cleanup on user exit
-- (covers the JOIN in deleteNonPersistentVariableValues)
CREATE INDEX IF NOT EXISTS idx_wvd_room_name_persist
    ON wired_variable_definitions(room_id, variable_name, is_persistent);

-- Insert catalog items for the new Wired effects.
-- NOTE: The sprite_id values (wf_act_give_user_variable and wf_act_change_user_variable)
-- must be registered in the items_base table. Adjust the item_id, sprite_id,
-- and catalog page/pricing as needed for your hotel setup.

-- Example items_base entries (uncomment and adjust as needed):
-- INSERT INTO `items_base` (`id`, `sprite_id`, `item_name`, `type`, `width`, `length`, `max_status`, `allow_stack`, `allow_sit`, `allow_lay`, `allow_walk`, `allow_gift`, `allow_trade`, `allow_recycle`, `allow_marketplace_sell`, `allow_inventory_stack`, `interaction_type`, `interaction_modes_count`, `vending_ids`, `is_chroma`, `customparams`, `effect_id_male`, `effect_id_female`, `clothing_on_walk`)
-- VALUES (NULL, 0, 'wf_act_define_user_variable', 's', 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 'wf_act_define_user_variable', 1, '0', 0, '', 0, 0, 0);

-- INSERT INTO `items_base` (`id`, `sprite_id`, `item_name`, `type`, `width`, `length`, `max_status`, `allow_stack`, `allow_sit`, `allow_lay`, `allow_walk`, `allow_gift`, `allow_trade`, `allow_recycle`, `allow_marketplace_sell`, `allow_inventory_stack`, `interaction_type`, `interaction_modes_count`, `vending_ids`, `is_chroma`, `customparams`, `effect_id_male`, `effect_id_female`, `clothing_on_walk`)
-- VALUES (NULL, 0, 'wf_act_give_user_variable', 's', 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 'wf_act_give_user_variable', 1, '0', 0, '', 0, 0, 0);

-- INSERT INTO `items_base` (`id`, `sprite_id`, `item_name`, `type`, `width`, `length`, `max_status`, `allow_stack`, `allow_sit`, `allow_lay`, `allow_walk`, `allow_gift`, `allow_trade`, `allow_recycle`, `allow_marketplace_sell`, `allow_inventory_stack`, `interaction_type`, `interaction_modes_count`, `vending_ids`, `is_chroma`, `customparams`, `effect_id_male`, `effect_id_female`, `clothing_on_walk`)
-- VALUES (NULL, 0, 'wf_act_change_user_variable', 's', 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 'wf_act_change_user_variable', 1, '0', 0, '', 0, 0, 0);

-- INSERT INTO `items_base` (`id`, `sprite_id`, `item_name`, `type`, `width`, `length`, `max_status`, `allow_stack`, `allow_sit`, `allow_lay`, `allow_walk`, `allow_gift`, `allow_trade`, `allow_recycle`, `allow_marketplace_sell`, `allow_inventory_stack`, `interaction_type`, `interaction_modes_count`, `vending_ids`, `is_chroma`, `customparams`, `effect_id_male`, `effect_id_female`, `clothing_on_walk`)
-- VALUES (NULL, 0, 'wf_trg_user_variable_changed', 's', 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 'wf_trg_user_variable_changed', 1, '0', 0, '', 0, 0, 0);
