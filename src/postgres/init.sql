CREATE TABLE players (
  id uuid PRIMARY KEY,
  playerName TEXT NOT NUll,
  color TEXT NOT NULL,
  active BOOLEAN DEFAULT false,
)