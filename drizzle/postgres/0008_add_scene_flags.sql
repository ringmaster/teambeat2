-- Create scene_flags table for flexible scene permissions
CREATE TABLE scene_flags (
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  flag TEXT NOT NULL,
  PRIMARY KEY (scene_id, flag)
);

-- Migrate existing boolean flags to scene_flags table
INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'allow_add_cards' FROM scenes WHERE allow_add_cards = TRUE;

INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'allow_edit_cards' FROM scenes WHERE allow_edit_cards = TRUE;

INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'allow_obscure_cards' FROM scenes WHERE allow_obscure_cards = TRUE;

INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'allow_move_cards' FROM scenes WHERE allow_move_cards = TRUE;

INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'allow_group_cards' FROM scenes WHERE allow_group_cards = TRUE;

INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'show_votes' FROM scenes WHERE show_votes = TRUE;

INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'allow_voting' FROM scenes WHERE allow_voting = TRUE;

INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'show_comments' FROM scenes WHERE show_comments = TRUE;

INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'allow_comments' FROM scenes WHERE allow_comments = TRUE;

INSERT INTO scene_flags (scene_id, flag)
SELECT id, 'multiple_votes_per_card' FROM scenes WHERE multiple_votes_per_card = TRUE;
