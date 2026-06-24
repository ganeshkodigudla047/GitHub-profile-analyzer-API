/**
 * Profile Detail Page JavaScript
 */

'use strict';

const API = '/api';
let profileData = null;

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavbar();
  loadProfile();
});

// ─── Theme ────────────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('themeToggle').textContent = saved === 'dark' ? '☀️' : '🌙';
  document.getElementById('themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    document.getElementById('themeToggle').textContent = next === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', next);
  });
}

function initNavbar() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  hamburger?.addEventListener('click', () => navLinks.classList.toggle('open'));
}

// ─── Load Profile ─────────────────────────────────────────────────────────────
async function loadProfile() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    showError();
    return;
  }

  try {
    const res = await fetch(`${API}/profiles/${id}`);
    const result = await res.json();

    if (!result.success || !result.data) {
      showError();
      return;
    }

    profileData = result.data;
    document.title = `@${profileData.username} — GitHub Analyzer`;

    renderProfileHero(profileData);
    renderProfileStats(profileData);
    renderProfileCharts(profileData);
    renderRepoInfo(profileData);
    renderAccountInfo(profileData);
    setupActions(profileData);

    document.getElementById('profileSkeleton').classList.add('hidden');
    document.getElementById('profileContent').classList.remove('hidden');
  } catch (e) {
    console.error('Profile load error:', e);
    showError();
  }
}

function showError() {
  document.getElementById('profileSkeleton').classList.add('hidden');
  document.getElementById('profileError').classList.remove('hidden');
}

// ─── Render Sections ──────────────────────────────────────────────────────────
function renderProfileHero(p) {
  const hero = document.getElementById('profileHero');
  hero.innerHTML = `
    ${p.avatar_url
      ? `<img src="${p.avatar_url}" alt="${p.username}" class="profile-avatar-large" />`
      : `<div class="avatar-placeholder" style="width:100px;height:100px;font-size:2rem;">${p.username[0].toUpperCase()}</div>`}
    <div class="profile-info">
      <div class="profile-name">${escapeHtml(p.name || p.username)}</div>
      <div class="profile-username">@${p.username}</div>
      ${p.bio ? `<div class="profile-bio">${escapeHtml(p.bio)}</div>` : ''}
      <div class="profile-meta">
        <span class="profile-meta-item"><i class="fas fa-user-friends"></i> ${Number(p.followers).toLocaleString()} followers</span>
        <span class="profile-meta-item"><i class="fas fa-heart"></i> ${Number(p.following).toLocaleString()} following</span>
        <span class="profile-meta-item"><i class="fas fa-book"></i> ${Number(p.public_repos).toLocaleString()} repos</span>
        <span class="profile-meta-item"><i class="fas fa-calendar-alt"></i> ${p.account_age_days} days old</span>
      </div>
      <div class="profile-score-badge">
        🏆 Profile Score: ${Number(p.profile_score).toLocaleString()}
      </div>
    </div>
  `;
}

function renderProfileStats(p) {
  const grid = document.getElementById('profileStatsGrid');
  const stats = [
    { icon: '⭐', label: 'Total Stars', value: Number(p.total_stars).toLocaleString() },
    { icon: '🍴', label: 'Total Forks', value: Number(p.total_forks).toLocaleString() },
    { icon: '💻', label: 'Top Language', value: p.most_used_language || 'N/A' },
    { icon: '📦', label: 'Total Repo Size', value: formatBytes(p.total_repo_size) },
    { icon: '📐', label: 'Avg Repo Size', value: formatBytes(p.average_repo_size) },
    { icon: '📅', label: 'Account Age', value: `${p.account_age_days} days` },
    { icon: '🏛️', label: 'Oldest Repo', value: p.oldest_repo || 'N/A' },
    { icon: '🆕', label: 'Newest Repo', value: p.newest_repo || 'N/A' },
  ];

  grid.innerHTML = stats.map(s => `
    <div class="profile-stat">
      <div class="value">${s.icon} ${s.value}</div>
      <div class="label">${s.label}</div>
    </div>
  `).join('');
}

function renderRepoInfo(p) {
  document.getElementById('repoInfo').innerHTML = `
    <div>📦 Public Repos: <strong>${Number(p.public_repos).toLocaleString()}</strong></div>
    <div>⭐ Total Stars: <strong>${Number(p.total_stars).toLocaleString()}</strong></div>
    <div>🍴 Total Forks: <strong>${Number(p.total_forks).toLocaleString()}</strong></div>
    <div>💾 Total Size: <strong>${formatBytes(p.total_repo_size)}</strong></div>
    <div>📊 Avg Size: <strong>${formatBytes(p.average_repo_size)}</strong></div>
    <div>🏛️ Oldest: <strong>${p.oldest_repo || 'N/A'}</strong></div>
    <div>🆕 Newest: <strong>${p.newest_repo || 'N/A'}</strong></div>
  `;
}

function renderAccountInfo(p) {
  document.getElementById('accountInfo').innerHTML = `
    <div>👤 Username: <strong>@${p.username}</strong></div>
    <div>📛 Name: <strong>${escapeHtml(p.name) || 'N/A'}</strong></div>
    <div>👥 Followers: <strong>${Number(p.followers).toLocaleString()}</strong></div>
    <div>❤️ Following: <strong>${Number(p.following).toLocaleString()}</strong></div>
    <div>🗓️ Account Age: <strong>${p.account_age_days} days</strong></div>
    <div>🏆 Score: <strong>${Number(p.profile_score).toLocaleString()}</strong></div>
    <div>🕐 Analyzed: <strong>${new Date(p.analyzed_at).toLocaleString()}</strong></div>
  `;
}

// ─── Charts ───────────────────────────────────────────────────────────────────
function renderProfileCharts(p) {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  // Language / metrics doughnut
  const langCtx = document.getElementById('profileLangChart');
  if (langCtx) {
    new Chart(langCtx, {
      type: 'doughnut',
      data: {
        labels: ['Followers', 'Following', 'Public Repos', 'Total Stars', 'Total Forks'],
        datasets: [{
          data: [p.followers, p.following, p.public_repos, p.total_stars, p.total_forks],
          backgroundColor: ['#6c63ff', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: textColor, font: { size: 11 }, boxWidth: 12 } },
        },
      },
    });
  }

  // Repo distribution bar chart
  const repoCtx = document.getElementById('repoDistChart');
  if (repoCtx) {
    new Chart(repoCtx, {
      type: 'bar',
      data: {
        labels: ['Stars', 'Forks', 'Public Repos', 'Followers'],
        datasets: [{
          label: 'Count',
          data: [p.total_stars, p.total_forks, p.public_repos, p.followers],
          backgroundColor: ['#f59e0b', '#06b6d4', '#6c63ff', '#10b981'],
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: { ticks: { color: textColor }, grid: { color: gridColor } },
        },
      },
    });
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────
function setupActions(p) {
  document.getElementById('githubLink').href = p.profile_url;

  document.getElementById('refreshBtn').addEventListener('click', async () => {
    const btn = document.getElementById('refreshBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner spinner-sm"></div> Refreshing...';

    try {
      const res = await fetch(`${API}/analyze/${p.username}`, { method: 'PUT' });
      const data = await res.json();
      if (data.success) {
        showToast('Profile refreshed!', 'success');
        setTimeout(() => location.reload(), 1200);
      } else {
        showToast(data.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sync"></i> Refresh Analysis';
      }
    } catch {
      showToast('Refresh failed', 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sync"></i> Refresh Analysis';
    }
  });

  document.getElementById('exportPdfBtn').addEventListener('click', () => {
    showToast('Generating PDF...', 'info');
    window.open(`${API}/profiles/${p.id}/export/pdf`, '_blank');
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(kb) {
  if (!kb || kb === 0) return '0 KB';
  if (kb < 1024) return `${kb} KB`;
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${(kb / (1024 * 1024)).toFixed(2)} GB`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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
