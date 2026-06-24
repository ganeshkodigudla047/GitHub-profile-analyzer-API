/**
 * Profile Model
 * Database operations for GitHub profiles
 */

const { query } = require('../config/db');
const logger = require('../utils/logger');

/**
 * Find a profile by username
 */
async function findByUsername(username) {
  const rows = await query(
    'SELECT * FROM github_profiles WHERE username = ? LIMIT 1',
    [username.toLowerCase()]
  );
  return rows[0] || null;
}

/**
 * Find a profile by ID
 */
async function findById(id) {
  const rows = await query(
    'SELECT * FROM github_profiles WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

/**
 * Insert or update a profile (upsert)
 */
async function upsert(profileData) {
  const {
    username, name, bio, followers, following, public_repos,
    total_stars, total_forks, most_used_language, total_repo_size,
    average_repo_size, oldest_repo, newest_repo, account_age_days,
    avatar_url, profile_url, profile_score, created_at, updated_at,
  } = profileData;

  const sql = `
    INSERT INTO github_profiles (
      username, name, bio, followers, following, public_repos,
      total_stars, total_forks, most_used_language, total_repo_size,
      average_repo_size, oldest_repo, newest_repo, account_age_days,
      avatar_url, profile_url, profile_score, created_at, updated_at, analyzed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      bio = VALUES(bio),
      followers = VALUES(followers),
      following = VALUES(following),
      public_repos = VALUES(public_repos),
      total_stars = VALUES(total_stars),
      total_forks = VALUES(total_forks),
      most_used_language = VALUES(most_used_language),
      total_repo_size = VALUES(total_repo_size),
      average_repo_size = VALUES(average_repo_size),
      oldest_repo = VALUES(oldest_repo),
      newest_repo = VALUES(newest_repo),
      account_age_days = VALUES(account_age_days),
      avatar_url = VALUES(avatar_url),
      profile_url = VALUES(profile_url),
      profile_score = VALUES(profile_score),
      updated_at = VALUES(updated_at),
      analyzed_at = NOW()
  `;

  const result = await query(sql, [
    username.toLowerCase(), name, bio, followers, following, public_repos,
    total_stars, total_forks, most_used_language, total_repo_size,
    average_repo_size, oldest_repo, newest_repo, account_age_days,
    avatar_url, profile_url, profile_score, created_at, updated_at,
  ]);

  logger.debug(`Profile upserted: ${username}`);
  return result;
}

/**
 * Get all profiles with pagination, search, sort
 */
async function findAll({ page = 1, limit = 10, search = '', language = '', sortBy = 'analyzed_at', order = 'DESC', minFollowers, maxFollowers } = {}) {
  const offset = (page - 1) * limit;
  const validSortFields = ['followers', 'public_repos', 'total_stars', 'profile_score', 'analyzed_at', 'username'];
  const validOrders = ['ASC', 'DESC'];

  const safeSort = validSortFields.includes(sortBy) ? sortBy : 'analyzed_at';
  const safeOrder = validOrders.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

  let conditions = [];
  let params = [];

  if (search && search.trim()) {
    conditions.push('(username LIKE ? OR name LIKE ?)');
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }
  if (language) {
    conditions.push('most_used_language = ?');
    params.push(language);
  }
  if (minFollowers !== undefined) {
    conditions.push('followers >= ?');
    params.push(parseInt(minFollowers));
  }
  if (maxFollowers !== undefined) {
    conditions.push('followers <= ?');
    params.push(parseInt(maxFollowers));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total records
  const countRows = await query(
    `SELECT COUNT(*) as total FROM github_profiles ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  // Fetch paginated records
  const rows = await query(
    `SELECT * FROM github_profiles ${whereClause} ORDER BY ${safeSort} ${safeOrder} LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  return {
    data: rows,
    totalRecords: total,
    currentPage: parseInt(page),
    totalPages: Math.ceil(total / limit),
    limit: parseInt(limit),
  };
}

/**
 * Delete a profile by ID
 */
async function deleteById(id) {
  const result = await query('DELETE FROM github_profiles WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

/**
 * Get platform statistics
 */
async function getStats() {
  const rows = await query(`
    SELECT
      COUNT(*) AS total_profiles,
      COALESCE(AVG(followers), 0) AS avg_followers,
      COALESCE(AVG(public_repos), 0) AS avg_repos,
      COALESCE(SUM(total_stars), 0) AS total_stars,
      COALESCE(AVG(profile_score), 0) AS avg_score,
      COALESCE(MAX(followers), 0) AS max_followers,
      COALESCE(MAX(total_stars), 0) AS max_stars,
      COALESCE(MAX(profile_score), 0) AS max_score
    FROM github_profiles
  `);
  return rows[0];
}

/**
 * Get language distribution
 */
async function getLanguageStats() {
  return query(`
    SELECT most_used_language AS language, COUNT(*) AS count
    FROM github_profiles
    WHERE most_used_language IS NOT NULL AND most_used_language != ''
    GROUP BY most_used_language
    ORDER BY count DESC
    LIMIT 15
  `);
}

/**
 * Get leaderboard
 */
async function getLeaderboard() {
  const [byFollowers, byRepos, byStars, byScore] = await Promise.all([
    query('SELECT username, avatar_url, followers AS value FROM github_profiles ORDER BY followers DESC LIMIT 10'),
    query('SELECT username, avatar_url, public_repos AS value FROM github_profiles ORDER BY public_repos DESC LIMIT 10'),
    query('SELECT username, avatar_url, total_stars AS value FROM github_profiles ORDER BY total_stars DESC LIMIT 10'),
    query('SELECT username, avatar_url, profile_score AS value FROM github_profiles ORDER BY profile_score DESC LIMIT 10'),
  ]);

  return { byFollowers, byRepos, byStars, byScore };
}

/**
 * Log an activity
 */
async function logActivity(action, username, details = '', ip = null) {
  try {
    await query(
      'INSERT INTO activity_log (action, username, details, ip_address) VALUES (?, ?, ?, ?)',
      [action, username.toLowerCase(), details, ip]
    );
  } catch (err) {
    logger.warn('Failed to log activity:', err.message);
  }
}

/**
 * Get recent activity
 */
async function getRecentActivity(limit = 20) {
  const safeLimit = parseInt(limit) || 20;
  return query(
    `SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ${safeLimit}`
  );
}

module.exports = {
  findByUsername,
  findById,
  upsert,
  findAll,
  deleteById,
  getStats,
  getLanguageStats,
  getLeaderboard,
  logActivity,
  getRecentActivity,
};
