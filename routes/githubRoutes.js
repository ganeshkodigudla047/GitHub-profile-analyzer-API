/**
 * GitHub Routes
 * All API endpoints for the GitHub Profile Analyzer
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/githubController');

// ─── Analysis ────────────────────────────────────────────────────────────────
// GET  /api/analyze/:username  - Analyze a GitHub profile
router.get('/analyze/:username', controller.analyzeProfile);

// PUT  /api/analyze/:username  - Refresh/re-analyze a profile
router.put('/analyze/:username', controller.refreshProfile);

// ─── Profiles ────────────────────────────────────────────────────────────────
// GET  /api/profiles           - Get all profiles (paginated, filterable)
router.get('/profiles', controller.getAllProfiles);

// GET  /api/profiles/search    - Search profiles (must be before /:id)
router.get('/profiles/search', controller.searchProfiles);

// GET  /api/profiles/export/csv - Export all profiles as CSV
router.get('/profiles/export/csv', controller.exportAllProfilesCSV);

// GET  /api/profiles/:id       - Get single profile by ID
router.get('/profiles/:id', controller.getProfileById);

// DELETE /api/profiles/:id     - Delete a profile
router.delete('/profiles/:id', controller.deleteProfile);

// GET  /api/profiles/:id/export/pdf - Export single profile as PDF
router.get('/profiles/:id/export/pdf', controller.exportProfilePDF);

// ─── Analytics ───────────────────────────────────────────────────────────────
// GET  /api/stats              - Platform statistics
router.get('/stats', controller.getStats);

// GET  /api/leaderboard        - Top profiles leaderboard
router.get('/leaderboard', controller.getLeaderboard);

// GET  /api/leaderboard/export/csv - Export leaderboard as CSV
router.get('/leaderboard/export/csv', controller.exportLeaderboardCSV);

// GET  /api/rate-limit         - GitHub API rate limit status
router.get('/rate-limit', controller.getRateLimit);

// GET  /api/recent             - Recent activity feed
router.get('/recent', controller.getRecentActivity);

module.exports = router;
