-- Create scene_flags table for flexible scene permissions
CREATE TABLE scene_flags (
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  flag TEXT NOT NULL,
  PRIMARY KEY (scene_id, flag)
);

-- Migrate existing boolean flags to scene_flags table
INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'allow_add_cards' FROM scenes WHERE allow_add_cards = 1;

INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'allow_edit_cards' FROM scenes WHERE allow_edit_cards = 1;

INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'allow_obscure_cards' FROM scenes WHERE allow_obscure_cards = 1;

INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'allow_move_cards' FROM scenes WHERE allow_move_cards = 1;

INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'allow_group_cards' FROM scenes WHERE allow_group_cards = 1;

INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'show_votes' FROM scenes WHERE show_votes = 1;

INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'allow_voting' FROM scenes WHERE allow_voting = 1;

INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'show_comments' FROM scenes WHERE show_comments = 1;

INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'allow_comments' FROM scenes WHERE allow_comments = 1;

INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'multiple_votes_per_card' FROM scenes WHERE multiple_votes_per_card = 1;
