CREATE TABLE IF NOT EXISTS user_passkeys (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  credential_id VARCHAR(512) NOT NULL,
  public_key MEDIUMTEXT NOT NULL,
  counter BIGINT UNSIGNED NOT NULL DEFAULT 0,
  device_type VARCHAR(32) NULL,
  backed_up BOOLEAN NOT NULL DEFAULT FALSE,
  transports VARCHAR(255) NULL,
  label VARCHAR(128) NULL,
  last_used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_passkeys_credential (credential_id),
  KEY idx_user_passkeys_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS passkey_challenges (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  purpose VARCHAR(32) NOT NULL,
  challenge VARCHAR(512) NOT NULL,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_passkey_challenges_user (user_id),
  KEY idx_passkey_challenges_expires (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
