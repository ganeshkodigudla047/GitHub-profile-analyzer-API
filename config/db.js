/**
 * Database Configuration
 * MySQL connection pool using mysql2
 */

const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

// Create connection pool for better performance
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'github_analyzer',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Reconnect on lost connection
  multipleStatements: false,
});

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    logger.info('✅ MySQL database connected successfully');
    conn.release();
    return true;
  } catch (error) {
    logger.error('❌ MySQL connection failed:', error.message);
    throw error;
  }
}

/**
 * Execute a query with optional parameters
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    logger.error('Database query error:', { sql: sql.substring(0, 100), error: error.message });
    throw error;
  }
}

module.exports = { pool, query, testConnection };
