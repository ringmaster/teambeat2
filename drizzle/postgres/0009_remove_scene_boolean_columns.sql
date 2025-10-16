-- Remove old boolean permission columns from scenes table
-- PostgreSQL supports DROP COLUMN, so this is straightforward

ALTER TABLE scenes DROP COLUMN allow_add_cards;
ALTER TABLE scenes DROP COLUMN allow_edit_cards;
ALTER TABLE scenes DROP COLUMN allow_obscure_cards;
ALTER TABLE scenes DROP COLUMN allow_move_cards;
ALTER TABLE scenes DROP COLUMN allow_group_cards;
ALTER TABLE scenes DROP COLUMN show_votes;
ALTER TABLE scenes DROP COLUMN allow_voting;
ALTER TABLE scenes DROP COLUMN show_comments;
ALTER TABLE scenes DROP COLUMN allow_comments;
ALTER TABLE scenes DROP COLUMN multiple_votes_per_card;
