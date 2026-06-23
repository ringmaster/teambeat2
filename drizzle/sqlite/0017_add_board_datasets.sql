-- board_datasets: per-board JSON document, fed from series-level push API
CREATE TABLE IF NOT EXISTS `board_datasets` (
  `id` text PRIMARY KEY NOT NULL,
  `board_id` text NOT NULL UNIQUE REFERENCES `boards`(`id`) ON DELETE CASCADE,
  `data` text,
  `updated_at` text NOT NULL,
  `updated_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `board_datasets_board_id_unique` ON `board_datasets` (`board_id`);
--> statement-breakpoint

-- data_scene_rules: relational rows defining how to query and render panels in a data scene
CREATE TABLE IF NOT EXISTS `data_scene_rules` (
  `id` text PRIMARY KEY NOT NULL,
  `scene_id` text NOT NULL REFERENCES `scenes`(`id`) ON DELETE CASCADE,
  `seq` integer NOT NULL DEFAULT 0,
  `section` text NOT NULL DEFAULT '',
  `label` text NOT NULL DEFAULT '',
  `query` text NOT NULL DEFAULT '',
  `panel_size` text NOT NULL DEFAULT 'medium',
  `title_template` text NOT NULL DEFAULT '',
  `body_template` text NOT NULL DEFAULT '',
  `copy_template` text,
  `emphasis_path` text,
  `emphasis_map` text,
  `builtin_template` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `data_scene_rules_scene_id_idx` ON `data_scene_rules` (`scene_id`);
