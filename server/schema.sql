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

CREATE TABLE IF NOT EXISTS hr_employee_sequences (
 day CHAR(8) PRIMARY KEY, serial INT UNSIGNED NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS hr_employees (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 employee_no VARCHAR(40) NOT NULL UNIQUE,
 user_id BIGINT UNSIGNED NULL UNIQUE,
 profile JSON NOT NULL,
 revision INT UNSIGNED NOT NULL DEFAULT 1,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY (user_id) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS hr_payroll (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 employee_id BIGINT UNSIGNED NOT NULL,
 month CHAR(7) NOT NULL,
 status ENUM('draft','published','requested','confirmed') NOT NULL DEFAULT 'draft',
 revision INT UNSIGNED NOT NULL DEFAULT 1,
 calculation JSON NOT NULL,
 published_snapshot JSON NULL,
 published_at DATETIME(6) NULL,
 confirmed_at DATETIME(6) NULL,
 UNIQUE KEY employee_month(employee_id,month),
 FOREIGN KEY (employee_id) REFERENCES hr_employees(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS hr_payroll_events (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 payroll_id BIGINT UNSIGNED NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 event VARCHAR(32) NOT NULL,
 note VARCHAR(1000) NOT NULL DEFAULT '',
 snapshot JSON NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY (payroll_id) REFERENCES hr_payroll(id),
 FOREIGN KEY (actor_id) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS test_employee_data (
 user_id BIGINT UNSIGNED PRIMARY KEY,
 state JSON NOT NULL,
 revision INT UNSIGNED NOT NULL DEFAULT 1,
 FOREIGN KEY (user_id) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sales_records (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 employee_id BIGINT UNSIGNED NOT NULL,
 department ENUM('insurance','cosmetics','health') NOT NULL,
 first_date DATE NOT NULL,
 customer_name VARCHAR(100) NOT NULL,
 phone VARCHAR(20) NOT NULL,
 address VARCHAR(500) NOT NULL,
 carrier VARCHAR(100) NOT NULL DEFAULT '',
 insurance_kind VARCHAR(10) NOT NULL DEFAULT '',
 birth_year SMALLINT NOT NULL,
 note VARCHAR(1000) NOT NULL DEFAULT '',
 status ENUM('pending','normal','as') NOT NULL DEFAULT 'pending',
 is_test BOOLEAN NOT NULL DEFAULT 0,
 request_key CHAR(36) NOT NULL UNIQUE,
 revision INT UNSIGNED NOT NULL DEFAULT 1,
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 INDEX sales_date (first_date,employee_id),
 FOREIGN KEY (employee_id) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS sales_events (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 sale_id BIGINT UNSIGNED NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 old_status VARCHAR(10) NOT NULL,
 new_status VARCHAR(10) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY (sale_id) REFERENCES sales_records(id),
 FOREIGN KEY (actor_id) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Optional consultation fields for new intakes; existing records remain unchanged.
CREATE TABLE IF NOT EXISTS sales_consultation_details (
 sale_id BIGINT UNSIGNED PRIMARY KEY,
 consultation_time VARCHAR(5) NOT NULL DEFAULT '',
 consultation_place VARCHAR(500) NOT NULL DEFAULT '',
 premium_band VARCHAR(6) NOT NULL DEFAULT '',
 FOREIGN KEY (sale_id) REFERENCES sales_records(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Company announcements and confirmed policy quota reductions.
CREATE TABLE IF NOT EXISTS office_notices (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 channel ENUM('company','activity') NOT NULL,
 department VARCHAR(20) NOT NULL DEFAULT '',
 title VARCHAR(120) NOT NULL,
 body VARCHAR(1500) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 source_key VARCHAR(128) NOT NULL UNIQUE,
 active BOOLEAN NOT NULL DEFAULT 1,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 INDEX notice_channel (channel,active,id),
 INDEX notice_department (department,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Shared intake policies, independent of browser/account local storage.
CREATE TABLE IF NOT EXISTS intake_policy_state (
 id TINYINT PRIMARY KEY,
 revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
 state JSON NOT NULL,
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO intake_policy_state(id,revision,state) VALUES(1,0,'{}');
CREATE TABLE IF NOT EXISTS intake_policy_history (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 revision BIGINT UNSIGNED NOT NULL UNIQUE,
 actor_id BIGINT UNSIGNED NOT NULL,
 action VARCHAR(20) NOT NULL,
 payload JSON NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY (actor_id) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Full birth dates for new intakes; legacy birth-year-only rows stay readable.
CREATE TABLE IF NOT EXISTS sales_birth_details (
 sale_id BIGINT UNSIGNED PRIMARY KEY,
 birth_date DATE NOT NULL,
 FOREIGN KEY (sale_id) REFERENCES sales_records(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS daily_grade_receipts (
 employee_id BIGINT UNSIGNED NOT NULL,
 performance_date DATE NOT NULL,
 milestone INT UNSIGNED NOT NULL,
 amount BIGINT UNSIGNED NOT NULL,
 department ENUM('insurance','cosmetics','health') NOT NULL,
 confirmed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY (employee_id, performance_date, milestone),
 FOREIGN KEY (employee_id) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Versioned employment contracts and read receipts.
CREATE TABLE IF NOT EXISTS hr_contract_settings (
 id TINYINT UNSIGNED PRIMARY KEY,
 settings JSON NOT NULL,
 revision INT UNSIGNED NOT NULL DEFAULT 1,
 updated_by BIGINT UNSIGNED NOT NULL,
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 FOREIGN KEY (updated_by) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS hr_contracts (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 employee_id BIGINT UNSIGNED NOT NULL,
 recipient_user_id BIGINT UNSIGNED NULL,
 version INT UNSIGNED NOT NULL,
 revision INT UNSIGNED NOT NULL DEFAULT 1,
 status ENUM('draft','issued','received') NOT NULL DEFAULT 'draft',
 terms JSON NOT NULL,
 issued_snapshot JSON NULL,
 content_hash CHAR(64) NULL,
 created_by BIGINT UNSIGNED NOT NULL,
 received_by BIGINT UNSIGNED NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 issued_at DATETIME(6) NULL,
 received_at DATETIME(6) NULL,
 UNIQUE KEY employee_contract_version(employee_id,version),
 KEY contract_recipient(recipient_user_id,status),
 FOREIGN KEY (employee_id) REFERENCES hr_employees(id),
 FOREIGN KEY (recipient_user_id) REFERENCES app_users(id),
 FOREIGN KEY (created_by) REFERENCES app_users(id),
 FOREIGN KEY (received_by) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS hr_contract_events (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 contract_id BIGINT UNSIGNED NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 event VARCHAR(30) NOT NULL,
 snapshot JSON NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY (contract_id) REFERENCES hr_contracts(id),
 FOREIGN KEY (actor_id) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
