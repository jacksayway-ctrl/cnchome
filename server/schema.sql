CREATE TABLE IF NOT EXISTS app_users (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 username VARCHAR(64) NOT NULL UNIQUE,
 display_name VARCHAR(100) NOT NULL,
 password_hash VARCHAR(255) NOT NULL,
 role ENUM('admin','employee') NOT NULL,
 department ENUM('insurance','cosmetics','health') NOT NULL,
 active BOOLEAN NOT NULL DEFAULT 1,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS login_limits (
 bucket CHAR(64) PRIMARY KEY,
 attempts INT NOT NULL DEFAULT 0,
 window_start DATETIME NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS grade_revision (
 id TINYINT PRIMARY KEY,
 revision BIGINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;
INSERT IGNORE INTO grade_revision(id,revision) VALUES(1,0);
CREATE TABLE IF NOT EXISTS grade_versions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 department ENUM('insurance','cosmetics','health') NOT NULL,
 effective_date DATE NOT NULL,
 saved_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 actor_id BIGINT UNSIGNED NOT NULL,
 actor_name VARCHAR(100) NOT NULL,
 policy JSON NOT NULL,
 INDEX dept_date (department,effective_date),
 FOREIGN KEY (actor_id) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
