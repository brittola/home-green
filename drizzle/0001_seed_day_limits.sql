INSERT INTO day_limits (weekday, max_remote) VALUES (1, 3), (2, 5), (3, 5), (4, 5), (5, 3) ON CONFLICT DO NOTHING;
