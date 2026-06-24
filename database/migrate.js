/**
 * Database Migration Script
 * Run: node database/migrate.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'railway',
    multipleStatements: false,
  });

  try {
    console.log('🔄 Running database migrations...');
    console.log(`📡 Connecting to: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

    // Create tables one by one (no multipleStatements needed)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS github_profiles (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        username          VARCHAR(100) NOT NULL UNIQUE,
        name              VARCHAR(255),
        bio               TEXT,
        followers         INT DEFAULT 0,
        following         INT DEFAULT 0,
        public_repos      INT DEFAULT 0,
        total_stars       INT DEFAULT 0,
        total_forks       INT DEFAULT 0,
        most_used_language VARCHAR(100),
        total_repo_size   BIGINT DEFAULT 0,
        average_repo_size DECIMAL(10,2) DEFAULT 0,
        oldest_repo       VARCHAR(255),
        newest_repo       VARCHAR(255),
        account_age_days  INT DEFAULT 0,
        avatar_url        VARCHAR(500),
        profile_url       VARCHAR(500),
        profile_score     INT DEFAULT 0,
        created_at        DATETIME,
        updated_at        DATETIME,
        analyzed_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_profile_score (profile_score DESC),
        INDEX idx_followers (followers DESC),
        INDEX idx_total_stars (total_stars DESC),
        INDEX idx_public_repos (public_repos DESC),
        INDEX idx_analyzed_at (analyzed_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ github_profiles table ready');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        action      ENUM('analyzed', 'refreshed', 'deleted', 'exported') NOT NULL,
        username    VARCHAR(100) NOT NULL,
        details     TEXT,
        ip_address  VARCHAR(45),
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created_at (created_at DESC),
        INDEX idx_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ activity_log table ready');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS language_stats (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        language      VARCHAR(100) NOT NULL UNIQUE,
        usage_count   INT DEFAULT 1,
        updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_usage_count (usage_count DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ language_stats table ready');

    console.log('\n✅ Database schema created successfully!');
    console.log(`📦 Database: ${process.env.DB_NAME}`);
    console.log('📋 Tables: github_profiles, activity_log, language_stats');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrate();
