CREATE TABLE IF NOT EXISTS collections (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  emoji      TEXT DEFAULT '📍',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collection_items (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id   UUID REFERENCES collections(id) ON DELETE CASCADE NOT NULL,
  place_id        TEXT NOT NULL,
  restaurant_name TEXT NOT NULL,
  lat             FLOAT NOT NULL,
  lng             FLOAT NOT NULL,
  address         TEXT,
  cuisine_type    TEXT,
  photo_url       TEXT,
  rating          FLOAT,
  added_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(collection_id, place_id)
);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='collections' AND policyname='users manage own collections') THEN
    CREATE POLICY "users manage own collections" ON collections FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='collection_items' AND policyname='users manage own collection items') THEN
    CREATE POLICY "users manage own collection items" ON collection_items FOR ALL
      USING (collection_id IN (SELECT id FROM collections WHERE user_id = auth.uid()));
  END IF;
END $$;
