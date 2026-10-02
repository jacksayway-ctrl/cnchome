<?php
// In-memory test schema only; production uses schema.sql.
$d->exec("CREATE TABLE grade_visibility(department TEXT PRIMARY KEY,daily INTEGER DEFAULT 1,weekly INTEGER DEFAULT 1,monthly INTEGER DEFAULT 1,revision INTEGER DEFAULT 0,actor_id INTEGER,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
INSERT INTO grade_visibility(department) VALUES('insurance'),('cosmetics'),('health');");
