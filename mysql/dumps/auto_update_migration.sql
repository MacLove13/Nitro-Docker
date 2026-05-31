-- Auto Update migration: tables for tracking SWF packs, furniture, effects and daily logs

CREATE TABLE IF NOT EXISTS `auto_update_swf_packs` (
  `id`             INT          NOT NULL AUTO_INCREMENT,
  `revision_name`  VARCHAR(255) NOT NULL,
  `download_url`   VARCHAR(500) DEFAULT NULL,
  `status`         ENUM('pending','processing','done','error') NOT NULL DEFAULT 'pending',
  `files_added`    INT          NOT NULL DEFAULT 0,
  `error_message`  TEXT         DEFAULT NULL,
  `created_at`     INT          NOT NULL DEFAULT 0,
  `updated_at`     INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_revision_name` (`revision_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `auto_update_furniture` (
  `id`             INT          NOT NULL AUTO_INCREMENT,
  `furniture_id`   VARCHAR(255) NOT NULL,
  `class_name`     VARCHAR(255) NOT NULL,
  `revision`       INT          NOT NULL DEFAULT 0,
  `download_url`   VARCHAR(500) DEFAULT NULL,
  `sql_insert`     MEDIUMTEXT   DEFAULT NULL,
  `xml_data`       MEDIUMTEXT   DEFAULT NULL,
  `status`         ENUM('pending','processing','done','error') NOT NULL DEFAULT 'pending',
  `error_message`  TEXT         DEFAULT NULL,
  `created_at`     INT          NOT NULL DEFAULT 0,
  `updated_at`     INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_furniture_id` (`furniture_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `auto_update_effects` (
  `id`             INT          NOT NULL AUTO_INCREMENT,
  `effect_name`    VARCHAR(255) NOT NULL,
  `revision`       INT          NOT NULL DEFAULT 0,
  `download_url`   VARCHAR(500) DEFAULT NULL,
  `status`         ENUM('pending','processing','done','error') NOT NULL DEFAULT 'pending',
  `error_message`  TEXT         DEFAULT NULL,
  `created_at`     INT          NOT NULL DEFAULT 0,
  `updated_at`     INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_effect_name` (`effect_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `auto_update_logs` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `log_date`   DATE         NOT NULL,
  `category`   ENUM('packs','furniture','effects','system') NOT NULL DEFAULT 'system',
  `message`    TEXT         NOT NULL,
  `created_at` INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_log_date` (`log_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `auto_update_cursor` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `type`         ENUM('furniture','effects') NOT NULL,
  `last_seen_id` VARCHAR(255) DEFAULT NULL,
  `updated_at`   INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cursor_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `auto_update_cursor` (`type`, `last_seen_id`, `updated_at`) VALUES
  ('furniture', NULL, 0),
  ('effects',   NULL, 0);
