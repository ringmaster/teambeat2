-- Add notes field to cards table
ALTER TABLE cards ADD COLUMN notes TEXT;

-- Add selected_card_id to scenes table
ALTER TABLE scenes ADD COLUMN selected_card_id TEXT REFERENCES cards(id) ON DELETE SET NULL;
