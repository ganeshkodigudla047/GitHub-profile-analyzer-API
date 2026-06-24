/**
 * GitHub Service
 * Handles all GitHub API interactions and insight calculations
 */

const axios = require('axios');
const logger = require('../utils/logger');

// GitHub API base URL
const GITHUB_API = 'https://api.github.com';

// Build headers (with optional auth token for higher rate limits)
function getHeaders() {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'GitHub-Profile-Analyzer/1.0',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

/**
 * Fetch user profile from GitHub
 * @param {string} username
 */
async function fetchUserProfile(username) {
  try {
    logger.info(`Fetching GitHub profile for: ${username}`);
    const response = await axios.get(`${GITHUB_API}/users/${username}`, {
      headers: getHeaders(),
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    handleGitHubError(error, username);
  }
}

/**
 * Fetch all public repositories for a user (handles pagination)
 * @param {string} username
 */
async function fetchUserRepos(username) {
  try {
    logger.info(`Fetching repositories for: ${username}`);
    let allRepos = [];
    let page = 1;
    const perPage = 100; // Max allowed by GitHub

    while (true) {
      const response = await axios.get(`${GITHUB_API}/users/${username}/repos`, {
        headers: getHeaders(),
        params: { per_page: perPage, page, type: 'owner', sort: 'updated' },
        timeout: 15000,
      });

      const repos = response.data;
      allRepos = allRepos.concat(repos);

      // If fewer results than requested, we've reached the last page
      if (repos.length < perPage) break;
      page++;

      // Safety cap at 500 repos to prevent abuse
      if (allRepos.length >= 500) break;
    }

    logger.info(`Fetched ${allRepos.length} repositories for: ${username}`);
    return allRepos;
  } catch (error) {
    handleGitHubError(error, username);
  }
}

/**
 * Get current GitHub rate limit status
 */
async function getRateLimit() {
  try {
    const response = await axios.get(`${GITHUB_API}/rate_limit`, {
      headers: getHeaders(),
      timeout: 8000,
    });
    return response.data.rate;
  } catch (error) {
    logger.error('Failed to fetch rate limit:', error.message);
    throw new Error('Failed to fetch GitHub rate limit information');
  }
}

/**
 * Calculate profile score
 * Formula: Followers×2 + PublicRepos×5 + TotalStars×3
 */
function calculateProfileScore(followers, publicRepos, totalStars) {
  return Math.round(followers * 2 + publicRepos * 5 + totalStars * 3);
}

/**
 * Calculate account age in days
 */
function calculateAccountAge(createdAt) {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
}

/**
 * Determine most used language from repos
 */
function getMostUsedLanguage(repos) {
  const langCount = {};
  for (const repo of repos) {
    if (repo.language) {
      langCount[repo.language] = (langCount[repo.language] || 0) + 1;
    }
  }
  if (Object.keys(langCount).length === 0) return null;
  return Object.entries(langCount).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Run full analysis for a GitHub username
 * Returns structured insight data ready to store
 */
async function analyzeProfile(username) {
  // Fetch in parallel for speed
  const [user, repos] = await Promise.all([
    fetchUserProfile(username),
    fetchUserRepos(username),
  ]);

  // Aggregate repo metrics
  const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
  const totalForks = repos.reduce((sum, r) => sum + (r.forks_count || 0), 0);
  const totalRepoSize = repos.reduce((sum, r) => sum + (r.size || 0), 0);
  const avgRepoSize = repos.length > 0 ? (totalRepoSize / repos.length).toFixed(2) : 0;
  const mostUsedLanguage = getMostUsedLanguage(repos);

  // Sort by creation date
  const sortedByDate = [...repos].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
  const oldestRepo = sortedByDate.length > 0 ? sortedByDate[0].name : null;
  const newestRepo = sortedByDate.length > 0 ? sortedByDate[sortedByDate.length - 1].name : null;

  const accountAgeDays = calculateAccountAge(user.created_at);
  const profileScore = calculateProfileScore(user.followers, user.public_repos, totalStars);

  return {
    username: user.login.toLowerCase(),
    name: user.name || null,
    bio: user.bio || null,
    followers: user.followers || 0,
    following: user.following || 0,
    public_repos: user.public_repos || 0,
    total_stars: totalStars,
    total_forks: totalForks,
    most_used_language: mostUsedLanguage,
    total_repo_size: totalRepoSize,
    average_repo_size: parseFloat(avgRepoSize),
    oldest_repo: oldestRepo,
    newest_repo: newestRepo,
    account_age_days: accountAgeDays,
    avatar_url: user.avatar_url || null,
    profile_url: user.html_url || `https://github.com/${user.login}`,
    profile_score: profileScore,
    created_at: user.created_at ? new Date(user.created_at) : null,
    updated_at: user.updated_at ? new Date(user.updated_at) : null,
  };
}

/**
 * Centralized GitHub API error handler
 */
function handleGitHubError(error, username) {
  if (error.response) {
    const status = error.response.status;
    if (status === 404) {
      const err = new Error(`GitHub user '${username}' not found`);
      err.statusCode = 404;
      throw err;
    }
    if (status === 403 || status === 429) {
      const resetTime = error.response.headers['x-ratelimit-reset'];
      const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000).toISOString() : 'unknown';
      const err = new Error(`GitHub API rate limit exceeded. Resets at: ${resetDate}`);
      err.statusCode = 429;
      throw err;
    }
    if (status === 401) {
      const err = new Error('Invalid or expired GitHub token');
      err.statusCode = 401;
      throw err;
    }
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    const err = new Error('GitHub API request timed out');
    err.statusCode = 504;
    throw err;
  }

  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    const err = new Error('Cannot reach GitHub API. Check network connection.');
    err.statusCode = 503;
    throw err;
  }

  logger.error('GitHub API error:', error.message);
  throw error;
}

module.exports = { fetchUserProfile, fetchUserRepos, getRateLimit, analyzeProfile };
