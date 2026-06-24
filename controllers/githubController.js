/**
 * GitHub Controller
 * Handles all API request/response logic
 */

const githubService = require('../services/githubService');
const profileModel = require('../models/profileModel');
const logger = require('../utils/logger');
const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');

// ─── Analyze Profile ────────────────────────────────────────────────────────

/**
 * GET /api/analyze/:username
 * Analyze a GitHub profile and store results
 */
async function analyzeProfile(req, res) {
  const { username } = req.params;

  if (!username || username.trim() === '') {
    return res.status(400).json({ success: false, message: 'Username is required' });
  }

  // Validate username format (GitHub allows alphanumeric + hyphens, max 39 chars)
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username)) {
    return res.status(400).json({ success: false, message: 'Invalid GitHub username format' });
  }

  try {
    logger.info(`Analyzing profile: ${username}`);

    const analysisData = await githubService.analyzeProfile(username);
    await profileModel.upsert(analysisData);
    await profileModel.logActivity('analyzed', username, `Profile analyzed`, req.ip);

    const saved = await profileModel.findByUsername(username);
    logger.info(`Profile analysis complete: ${username} | Score: ${analysisData.profile_score}`);

    return res.status(200).json({
      success: true,
      message: 'Profile analyzed successfully',
      data: saved,
    });
  } catch (error) {
    logger.error(`Analysis failed for ${username}:`, error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message });
  }
}

/**
 * PUT /api/analyze/:username
 * Refresh (re-analyze) an existing profile
 */
async function refreshProfile(req, res) {
  const { username } = req.params;

  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username)) {
    return res.status(400).json({ success: false, message: 'Invalid GitHub username format' });
  }

  try {
    const analysisData = await githubService.analyzeProfile(username);
    await profileModel.upsert(analysisData);
    await profileModel.logActivity('refreshed', username, 'Profile refreshed', req.ip);

    const updated = await profileModel.findByUsername(username);
    return res.status(200).json({
      success: true,
      message: 'Profile refreshed successfully',
      data: updated,
    });
  } catch (error) {
    logger.error(`Refresh failed for ${username}:`, error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message });
  }
}

// ─── Profile CRUD ────────────────────────────────────────────────────────────

/**
 * GET /api/profiles
 * Fetch all profiles with pagination, search, filter, sort
 */
async function getAllProfiles(req, res) {
  try {
    const {
      page = 1, limit = 10, q = '', language = '',
      sortBy = 'analyzed_at', order = 'DESC',
      minFollowers, maxFollowers,
    } = req.query;

    const result = await profileModel.findAll({
      page: Math.max(1, parseInt(page)),
      limit: Math.min(100, Math.max(1, parseInt(limit))),
      search: q.trim(),
      language: language.trim(),
      sortBy,
      order,
      minFollowers,
      maxFollowers,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    logger.error('Get all profiles error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch profiles' });
  }
}

/**
 * GET /api/profiles/search?q=username
 * Search profiles by username or name
 */
async function searchProfiles(req, res) {
  try {
    const { q = '', page = 1, limit = 10 } = req.query;
    if (!q.trim()) {
      return res.status(400).json({ success: false, message: 'Search query (q) is required' });
    }

    const result = await profileModel.findAll({
      page: parseInt(page),
      limit: parseInt(limit),
      search: q.trim(),
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    logger.error('Search profiles error:', error.message);
    return res.status(500).json({ success: false, message: 'Search failed' });
  }
}

/**
 * GET /api/profiles/:id
 * Fetch a single profile by ID
 */
async function getProfileById(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ success: false, message: 'Invalid profile ID' });
    }

    const profile = await profileModel.findById(id);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    logger.error('Get profile by ID error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
}

/**
 * DELETE /api/profiles/:id
 * Delete a profile by ID
 */
async function deleteProfile(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ success: false, message: 'Invalid profile ID' });
    }

    const profile = await profileModel.findById(id);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    await profileModel.deleteById(id);
    await profileModel.logActivity('deleted', profile.username, `Profile deleted (ID: ${id})`, req.ip);

    return res.status(200).json({ success: true, message: 'Profile deleted successfully' });
  } catch (error) {
    logger.error('Delete profile error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to delete profile' });
  }
}

// ─── Analytics & Stats ───────────────────────────────────────────────────────

/**
 * GET /api/stats
 * Get overall platform statistics
 */
async function getStats(req, res) {
  try {
    const [stats, languages] = await Promise.all([
      profileModel.getStats(),
      profileModel.getLanguageStats(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        ...stats,
        total_profiles: parseInt(stats.total_profiles),
        avg_followers: parseFloat(stats.avg_followers).toFixed(1),
        avg_repos: parseFloat(stats.avg_repos).toFixed(1),
        avg_score: parseFloat(stats.avg_score).toFixed(1),
        language_distribution: languages,
      },
    });
  } catch (error) {
    logger.error('Get stats error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
}

/**
 * GET /api/leaderboard
 * Get top profiles across different metrics
 */
async function getLeaderboard(req, res) {
  try {
    const leaderboard = await profileModel.getLeaderboard();
    return res.status(200).json({ success: true, data: leaderboard });
  } catch (error) {
    logger.error('Leaderboard error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch leaderboard' });
  }
}

/**
 * GET /api/rate-limit
 * Get GitHub API rate limit status
 */
async function getRateLimit(req, res) {
  try {
    const rateLimit = await githubService.getRateLimit();
    return res.status(200).json({ success: true, data: rateLimit });
  } catch (error) {
    logger.error('Rate limit error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/recent
 * Get recent activity feed
 */
async function getRecentActivity(req, res) {
  try {
    const { limit = 20 } = req.query;
    const activity = await profileModel.getRecentActivity(Math.min(50, parseInt(limit)));
    return res.status(200).json({ success: true, data: activity });
  } catch (error) {
    logger.error('Recent activity error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch activity' });
  }
}

// ─── Export ──────────────────────────────────────────────────────────────────

/**
 * GET /api/profiles/:id/export/pdf
 * Export a single profile as PDF
 */
async function exportProfilePDF(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ success: false, message: 'Invalid profile ID' });
    }

    const profile = await profileModel.findById(id);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    await profileModel.logActivity('exported', profile.username, 'PDF export', req.ip);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${profile.username}-profile.pdf"`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    // Header
    doc.rect(0, 0, 612, 80).fill('#1a1a2e');
    doc.fill('#ffffff').fontSize(24).font('Helvetica-Bold')
      .text('GitHub Profile Analyzer', 50, 25);
    doc.fontSize(11).font('Helvetica')
      .text('Professional Profile Report', 50, 55);

    // Profile Info
    doc.fill('#000000').moveDown(3);
    doc.fontSize(20).font('Helvetica-Bold').text(`@${profile.username}`, 50, 100);
    if (profile.name) {
      doc.fontSize(14).font('Helvetica').fill('#444').text(profile.name, 50, 128);
    }
    if (profile.bio) {
      doc.fontSize(11).fill('#666').text(profile.bio, 50, 148, { width: 512 });
    }

    // Divider
    doc.moveTo(50, 180).lineTo(562, 180).stroke('#ddd');

    // Stats Grid
    const statsY = 195;
    doc.fontSize(13).font('Helvetica-Bold').fill('#1a1a2e').text('Profile Statistics', 50, statsY);

    const stats = [
      ['Followers', profile.followers],
      ['Following', profile.following],
      ['Public Repos', profile.public_repos],
      ['Total Stars', profile.total_stars],
      ['Total Forks', profile.total_forks],
      ['Profile Score', profile.profile_score],
      ['Account Age', `${profile.account_age_days} days`],
      ['Top Language', profile.most_used_language || 'N/A'],
      ['Total Repo Size', `${(profile.total_repo_size / 1024).toFixed(1)} MB`],
      ['Oldest Repo', profile.oldest_repo || 'N/A'],
      ['Newest Repo', profile.newest_repo || 'N/A'],
    ];

    let statY = statsY + 25;
    stats.forEach(([label, value], i) => {
      const x = i % 2 === 0 ? 50 : 320;
      if (i % 2 === 0 && i > 0) statY += 28;
      doc.fontSize(10).font('Helvetica').fill('#666').text(label, x, statY);
      doc.fontSize(12).font('Helvetica-Bold').fill('#000').text(String(value), x, statY + 13);
    });

    // Footer
    const footerY = 750;
    doc.moveTo(50, footerY).lineTo(562, footerY).stroke('#ddd');
    doc.fontSize(9).fill('#999').font('Helvetica')
      .text(`Generated by GitHub Profile Analyzer | ${new Date().toLocaleString()}`, 50, footerY + 10);
    doc.text(`Profile URL: ${profile.profile_url}`, 50, footerY + 22);

    doc.end();
  } catch (error) {
    logger.error('PDF export error:', error.message);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Failed to generate PDF' });
    }
  }
}

/**
 * GET /api/profiles/export/csv
 * Export all profiles as CSV
 */
async function exportAllProfilesCSV(req, res) {
  try {
    const result = await profileModel.findAll({ page: 1, limit: 10000 });

    const fields = [
      'id', 'username', 'name', 'followers', 'following', 'public_repos',
      'total_stars', 'total_forks', 'most_used_language', 'profile_score',
      'account_age_days', 'total_repo_size', 'average_repo_size',
      'oldest_repo', 'newest_repo', 'profile_url', 'analyzed_at',
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(result.data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="github-profiles.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    logger.error('CSV export error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to export CSV' });
  }
}

/**
 * GET /api/leaderboard/export/csv
 * Export leaderboard as CSV
 */
async function exportLeaderboardCSV(req, res) {
  try {
    const leaderboard = await profileModel.getLeaderboard();
    const topProfiles = leaderboard.byScore;

    const parser = new Parser({ fields: ['username', 'value'] });
    const csv = parser.parse(topProfiles);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leaderboard.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    logger.error('Leaderboard CSV export error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to export leaderboard' });
  }
}

module.exports = {
  analyzeProfile,
  refreshProfile,
  getAllProfiles,
  searchProfiles,
  getProfileById,
  deleteProfile,
  getStats,
  getLeaderboard,
  getRateLimit,
  getRecentActivity,
  exportProfilePDF,
  exportAllProfilesCSV,
  exportLeaderboardCSV,
};
