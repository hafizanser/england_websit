-- Homepage reel videos table (admin-managed homepage videos).
-- Run this ONCE on the live database (phpMyAdmin -> Import, or SQL tab) if you
-- cannot run `php artisan migrate --force`. Safe to run repeatedly.
CREATE TABLE IF NOT EXISTS `homepage_videos` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NULL,
  `position` INT NOT NULL DEFAULT 0,
  `source_type` VARCHAR(16) NOT NULL DEFAULT 'upload',
  `video_file` VARCHAR(255) NULL,
  `poster_file` VARCHAR(255) NULL,
  `drive_url` TEXT NULL,
  `is_active` TINYINT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `homepage_videos_is_active_position_index` (`is_active`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
