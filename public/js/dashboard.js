/**
 * Dashboard JavaScript
 * Handles all dashboard interactions, API calls, and UI updates
 */

'use strict';

const API = '/api';

// ─── State ───────────────────────────────────────────────────────────────────
let currentPage = 1;
let totalPages = 1;
let pendingDeleteId = null;
let searchDebounce = null;
let langChart = null, followersChart = null, scoreChart = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavbar();
  initSearch();
  loadAll();
  // Refresh activity & rate limit every 30s
  setInterval(() => { loadRateLimit(); loadActivity(); }, 30000);
});

function loadAll() {
  loadStats();
  loadProfiles();
  loadLeaderboard();
  loadActivity();
  loadRateLimit();
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
  document.getElementById('themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('theme', theme);
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function initNavbar() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
}

// ─── Search & Analyze ─────────────────────────────────────────────────────────
function initSearch() {
  const input = document.getElementById('usernameInput');
  const btn = document.getElementById('analyzeBtn');

  btn.addEventListener('click', analyzeProfile);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') analyzeProfile(); });

  // Table filters
  document.getElementById('searchInput').addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => { currentPage = 1; loadProfiles(); }, 400);
  });
  ['langFilter', 'sortSelect', 'orderSelect'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => { currentPage = 1; loadProfiles(); });
  });
}

async function analyzeProfile() {
  const username = document.getElementById('usernameInput').value.trim();
  if (!username) { showToast('Please enter a GitHub username', 'warning'); return; }

  const btn = document.getElementById('analyzeBtn');
  const overlay = document.getElementById('loadingOverlay');

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm"></div> Analyzing...';
  overlay.classList.add('active');

  try {
    const res = await fetch(`${API}/analyze/${encodeURIComponent(username)}`);
    const data = await res.json();

    if (data.success) {
      showToast(`✅ @${data.data.username} analyzed! Score: ${data.data.profile_score.toLocaleString()}`, 'success');
      document.getElementById('usernameInput').value = '';
      loadAll();
    } else {
      showToast(data.message || 'Analysis failed', 'error');
    }
  } catch (err) {
    showToast('Network error. Is the server running?', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-search"></i> Analyze';
    overlay.classList.remove('active');
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const res = await fetch(`${API}/stats`);
    const { data } = await res.json();

    document.getElementById('statTotalProfiles').textContent = Number(data.total_profiles).toLocaleString();
    document.getElementById('statAvgFollowers').textContent = Number(data.avg_followers).toLocaleString();
    document.getElementById('statTopLanguage').textContent = data.language_distribution[0]?.language || '—';
    document.getElementById('statTotalStars').textContent = Number(data.total_stars).toLocaleString();
    document.getElementById('statAvgScore').textContent = Number(data.avg_score).toLocaleString();

    renderLanguageChart(data.language_distribution);
    populateLangFilter(data.language_distribution);
  } catch (e) {
    console.error('Stats load failed:', e);
  }
}

function populateLangFilter(langs) {
  const sel = document.getElementById('langFilter');
  const existing = [...sel.options].map(o => o.value);
  langs.forEach(({ language }) => {
    if (language && !existing.includes(language)) {
      const opt = document.createElement('option');
      opt.value = language;
      opt.textContent = language;
      sel.appendChild(opt);
    }
  });
}

// ─── Profiles Table ───────────────────────────────────────────────────────────
async function loadProfiles() {
  const search = document.getElementById('searchInput').value;
  const language = document.getElementById('langFilter').value;
  const sortBy = document.getElementById('sortSelect').value;
  const order = document.getElementById('orderSelect').value;

  const params = new URLSearchParams({
    page: currentPage, limit: 10,
    q: search, language, sortBy, order,
  });

  try {
    const res = await fetch(`${API}/profiles?${params}`);
    const result = await res.json();

    totalPages = result.totalPages || 1;
    renderProfilesTable(result.data || []);
    renderPagination(result);
    renderFollowersChart(result.data || []);
    renderScoreChart(result.data || []);
  } catch (e) {
    console.error('Profiles load failed:', e);
  }
}

function renderProfilesTable(profiles) {
  const tbody = document.getElementById('profilesTableBody');

  if (!profiles.length) {
    tbody.innerHTML = `<tr><td colspan="9">
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>No profiles found</h3>
        <p>Analyze a GitHub profile to get started.</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = profiles.map((p, i) => `
    <tr>
      <td style="color:var(--text-dim);font-size:0.8rem;">${(currentPage - 1) * 10 + i + 1}</td>
      <td>
        <div class="user-cell">
          ${p.avatar_url
            ? `<img src="${p.avatar_url}" alt="${p.username}" class="avatar" loading="lazy" />`
            : `<div class="avatar-placeholder">${p.username[0].toUpperCase()}</div>`}
          <div>
            <a href="/profile?id=${p.id}" class="username-link">@${p.username}</a>
            ${p.name ? `<div style="font-size:0.78rem;color:var(--text-dim);">${escapeHtml(p.name)}</div>` : ''}
          </div>
        </div>
      </td>
      <td>${Number(p.followers).toLocaleString()}</td>
      <td>${Number(p.public_repos).toLocaleString()}</td>
      <td>⭐ ${Number(p.total_stars).toLocaleString()}</td>
      <td>${p.most_used_language ? `<span class="badge badge-lang">${p.most_used_language}</span>` : '<span style="color:var(--text-dim);">—</span>'}</td>
      <td><span class="badge badge-score">${Number(p.profile_score).toLocaleString()}</span></td>
      <td style="color:var(--text-dim);font-size:0.8rem;">${timeAgo(p.analyzed_at)}</td>
      <td>
        <div class="action-buttons">
          <a href="/profile?id=${p.id}" class="btn btn-outline btn-sm btn-icon" title="View Profile"><i class="fas fa-eye"></i></a>
          <button onclick="refreshProfile('${p.username}', this)" class="btn btn-success btn-sm btn-icon" title="Refresh"><i class="fas fa-sync"></i></button>
          <button onclick="openDeleteModal(${p.id}, '${p.username}')" class="btn btn-danger btn-sm btn-icon" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderPagination({ totalRecords, currentPage: cp, totalPages: tp, limit }) {
  const container = document.getElementById('paginationContainer');
  const info = document.getElementById('paginationInfo');
  const buttons = document.getElementById('paginationButtons');

  if (!totalRecords) { container.style.display = 'none'; return; }
  container.style.display = 'flex';

  const from = (cp - 1) * limit + 1;
  const to = Math.min(cp * limit, totalRecords);
  info.textContent = `Showing ${from}–${to} of ${totalRecords} profiles`;

  let html = `<button class="page-btn" onclick="goToPage(${cp - 1})" ${cp === 1 ? 'disabled' : ''}>‹</button>`;

  const range = getPageRange(cp, tp);
  range.forEach(p => {
    if (p === '...') {
      html += `<button class="page-btn" disabled>…</button>`;
    } else {
      html += `<button class="page-btn ${p === cp ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
    }
  });

  html += `<button class="page-btn" onclick="goToPage(${cp + 1})" ${cp === tp ? 'disabled' : ''}>›</button>`;
  buttons.innerHTML = html;
}

function getPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
}

function goToPage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  loadProfiles();
  document.getElementById('profiles-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Actions ──────────────────────────────────────────────────────────────────
async function refreshProfile(username, btn) {
  const icon = btn.querySelector('i');
  icon.className = 'fas fa-spinner fa-spin';
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/analyze/${username}`, { method: 'PUT' });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ @${username} refreshed!`, 'success');
      loadAll();
    } else {
      showToast(data.message, 'error');
    }
  } catch {
    showToast('Refresh failed', 'error');
  } finally {
    icon.className = 'fas fa-sync';
    btn.disabled = false;
  }
}

function openDeleteModal(id, username) {
  pendingDeleteId = id;
  document.getElementById('deleteUsername').textContent = `@${username}`;
  document.getElementById('deleteModal').classList.add('active');

  document.getElementById('confirmDeleteBtn').onclick = async () => {
    closeModal('deleteModal');
    try {
      const res = await fetch(`${API}/profiles/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Profile deleted', 'success');
        loadAll();
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Delete failed', 'error');
    }
  };
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

async function exportCSV() {
  showToast('Preparing CSV export...', 'info');
  window.open(`${API}/profiles/export/csv`, '_blank');
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
async function loadLeaderboard() {
  try {
    const res = await fetch(`${API}/leaderboard`);
    const { data } = await res.json();
    renderLeaderboard(data);
  } catch (e) {
    console.error('Leaderboard failed:', e);
  }
}

function renderLeaderboard({ byFollowers, byRepos, byStars, byScore }) {
  const grid = document.getElementById('leaderboardGrid');
  const boards = [
    { title: '👥 Top Followers', items: byFollowers, label: 'followers' },
    { title: '📦 Top Repos', items: byRepos, label: 'repos' },
    { title: '⭐ Top Stars', items: byStars, label: 'stars' },
    { title: '🏆 Top Score', items: byScore, label: 'score' },
  ];

  grid.innerHTML = boards.map(({ title, items, label }) => `
    <div class="leaderboard-card">
      <h3>${title}</h3>
      ${items.map((item, i) => `
        <div class="leaderboard-item">
          <div class="rank ${i < 3 ? `rank-${i + 1}` : 'rank-other'}">${i + 1}</div>
          ${item.avatar_url
            ? `<img src="${item.avatar_url}" class="lb-avatar" alt="${item.username}" loading="lazy" />`
            : `<div class="avatar-placeholder" style="width:32px;height:32px;font-size:0.75rem;">${item.username[0].toUpperCase()}</div>`}
          <div class="lb-info">
            <div class="lb-username">@${item.username}</div>
            <div class="lb-value">${Number(item.value).toLocaleString()} ${label}</div>
          </div>
        </div>
      `).join('')}
      ${!items.length ? '<p style="font-size:0.8rem;color:var(--text-dim);">No data yet</p>' : ''}
    </div>
  `).join('');
}

// ─── Activity Feed ────────────────────────────────────────────────────────────
async function loadActivity() {
  try {
    const res = await fetch(`${API}/recent?limit=15`);
    const { data } = await res.json();
    renderActivity(data);
  } catch {}
}

function renderActivity(items) {
  const feed = document.getElementById('activityFeed');
  if (!items || !items.length) {
    feed.innerHTML = '<p style="font-size:0.85rem;color:var(--text-muted);">No activity yet.</p>';
    return;
  }

  const icons = { analyzed: '🔍', refreshed: '🔄', deleted: '🗑️', exported: '📤' };
  const labels = { analyzed: 'analyzed', refreshed: 'refreshed', deleted: 'deleted', exported: 'exported' };

  feed.innerHTML = items.map(item => `
    <div class="activity-item">
      <div class="activity-dot dot-${item.action}"></div>
      <div>
        <div class="activity-text">${icons[item.action] || '•'} <strong>@${item.username}</strong> ${labels[item.action] || item.action}</div>
        <div class="activity-time">${timeAgo(item.created_at)}</div>
      </div>
    </div>
  `).join('');
}

// ─── Rate Limit ───────────────────────────────────────────────────────────────
async function loadRateLimit() {
  try {
    const res = await fetch(`${API}/rate-limit`);
    const { data } = await res.json();
    const pct = Math.round((data.remaining / data.limit) * 100);
    const resetTime = new Date(data.reset * 1000).toLocaleTimeString();
    const color = pct > 50 ? 'var(--success)' : pct > 20 ? 'var(--warning)' : 'var(--danger)';

    document.getElementById('rateLimitContent').innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span>Remaining: <strong style="color:${color};">${data.remaining.toLocaleString()}</strong></span>
        <span>Limit: ${data.limit.toLocaleString()}</span>
      </div>
      <div class="rate-limit-bar">
        <div class="rate-limit-fill" style="width:${pct}%;background:linear-gradient(90deg,${color},var(--primary));"></div>
      </div>
      <div style="margin-top:8px;font-size:0.78rem;color:var(--text-dim);">Resets at ${resetTime} · ${data.used} used</div>
    `;
  } catch {
    document.getElementById('rateLimitContent').innerHTML = '<span style="color:var(--text-dim);">Unable to fetch rate limit</span>';
  }
}

// ─── Charts ───────────────────────────────────────────────────────────────────
const CHART_COLORS = [
  '#6c63ff','#06b6d4','#f43f5e','#10b981','#f59e0b',
  '#8b5cf6','#ec4899','#14b8a6','#f97316','#3b82f6',
  '#a78bfa','#34d399','#fb923c','#60a5fa','#e879f9',
];

function getChartDefaults() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  return {
    textColor: isDark ? '#94a3b8' : '#475569',
    gridColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
  };
}

function renderLanguageChart(langs) {
  const ctx = document.getElementById('langChart');
  if (!ctx) return;
  if (langChart) langChart.destroy();

  const { textColor } = getChartDefaults();
  langChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: langs.map(l => l.language),
      datasets: [{
        data: langs.map(l => l.count),
        backgroundColor: CHART_COLORS,
        borderWidth: 2,
        borderColor: 'transparent',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: textColor, font: { size: 11 }, padding: 12, boxWidth: 12 },
        },
      },
    },
  });
}

function renderFollowersChart(profiles) {
  const ctx = document.getElementById('followersChart');
  if (!ctx) return;
  if (followersChart) followersChart.destroy();

  const { textColor, gridColor } = getChartDefaults();
  const top = [...profiles].sort((a, b) => b.followers - a.followers).slice(0, 8);

  followersChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(p => `@${p.username}`),
      datasets: [{
        label: 'Followers',
        data: top.map(p => p.followers),
        backgroundColor: CHART_COLORS.slice(0, top.length),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
      },
    },
  });
}

function renderScoreChart(profiles) {
  const ctx = document.getElementById('scoreChart');
  if (!ctx) return;
  if (scoreChart) scoreChart.destroy();

  const { textColor, gridColor } = getChartDefaults();
  const top = [...profiles].sort((a, b) => b.profile_score - a.profile_score).slice(0, 8);

  scoreChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(p => `@${p.username}`),
      datasets: [{
        label: 'Profile Score',
        data: top.map(p => p.profile_score),
        backgroundColor: 'rgba(108, 99, 255, 0.7)',
        borderColor: '#6c63ff',
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
      },
    },
  });
}

// ─── Toast Notifications ──────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-message">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Responsive bottom grid
function adjustLayout() {
  const grid = document.getElementById('bottomGrid');
  if (grid) {
    grid.style.gridTemplateColumns = window.innerWidth < 900 ? '1fr' : '1fr 340px';
  }
}
window.addEventListener('resize', adjustLayout);
adjustLayout();
