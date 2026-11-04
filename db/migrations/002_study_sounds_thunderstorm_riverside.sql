-- Study sounds: White noise and Pink noise are replaced by Thunderstorm and Riverside.
-- SQLite can't change a CHECK constraint in place, so the table is rebuilt with the new list.
-- Anyone whose saved sound was white or pink noise is moved to Rain (the default, free sound).
CREATE TABLE study_audio_preferences_new (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sound_key   TEXT NOT NULL DEFAULT 'rain' CHECK (sound_key IN ('rain', 'ocean', 'forest', 'fireplace', 'fan', 'thunderstorm', 'brown', 'riverside')),
  volume      REAL NOT NULL DEFAULT 0.5 CHECK (volume BETWEEN 0 AND 1),
  updated_at  INTEGER NOT NULL
);

INSERT INTO study_audio_preferences_new (user_id, sound_key, volume, updated_at)
SELECT user_id, CASE WHEN sound_key IN ('white', 'pink') THEN 'rain' ELSE sound_key END, volume, updated_at
FROM study_audio_preferences;

DROP TABLE study_audio_preferences;

ALTER TABLE study_audio_preferences_new RENAME TO study_audio_preferences;
