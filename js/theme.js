/**
 * THEME.JS - Dark Mode Management
 * Handles theme toggle, persistence, and icon updates.
 */

const THEME_KEY = 'potholeDetectTheme';

function getStoredTheme() {
  return localStorage.getItem(THEME_KEY);
}

function getPreferredTheme() {
  const stored = getStoredTheme();
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.dataset.bsTheme = theme;
  localStorage.setItem(THEME_KEY, theme);
  updateToggleButtons(theme);
}

function updateToggleButtons(theme) {
  const isDark = theme === 'dark';
  document.querySelectorAll('.theme-toggle-trigger').forEach(function (btn) {
    btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    btn.title = isDark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap';
  });
}

function toggleTheme() {
  const current = document.documentElement.dataset.bsTheme || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.theme-toggle-trigger').forEach(function (btn) {
    btn.addEventListener('click', toggleTheme);
  });

  // Sync button state with current theme (already set by anti-FOUC script in head)
  updateToggleButtons(document.documentElement.dataset.bsTheme || 'light');

  // Listen for OS-level theme changes (if user has no stored preference)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    if (!getStoredTheme()) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
});
