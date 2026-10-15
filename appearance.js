(() => {
  'use strict';
  const STORAGE_KEY = 'morning-brief-appearance-v1';
  const root = document.documentElement;
  const validColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  let preferences = {dark: false, color: '#80ffff'};
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) preferences = {dark: saved.dark === true, color: validColor(saved.color) ? saved.color : preferences.color};
  } catch {}
  function readableColor(color) {
    let channels = [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16));
    const luminance = values => values.map(value => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
    while ((luminance(channels) + 0.05) / (0.0061 + 0.05) < 7) {
      channels = channels.map(value => Math.min(255, value + 1));
    }
    return '#' + channels.map(value => value.toString(16).padStart(2, '0')).join('');
  }
  function applyAppearance() {
    root.dataset.theme = preferences.dark ? 'contrast' : 'light';
    root.style.setProperty('--contrast-accent', readableColor(preferences.color));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = preferences.dark ? '#000000' : '#f7f6f2';
  }
  applyAppearance();
  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('contrastMode');
    const picker = document.getElementById('contrastColor');
    const help = document.getElementById('contrastColorHelp');
    const presets = [...document.querySelectorAll('[data-contrast-color]')];
    function updateControls() {
      toggle.checked = preferences.dark;
      picker.value = preferences.color;
      const adjusted = readableColor(preferences.color);
      help.textContent = adjusted.toLowerCase() !== preferences.color.toLowerCase()
        ? `Your color is brightened to ${adjusted.toUpperCase()} to keep text easy to read.`
        : 'Your chosen color meets the high-contrast brightness target.';
      for (const preset of presets) preset.setAttribute('aria-pressed', String(preset.dataset.contrastColor === preferences.color));
    }
    function saveAppearance() {
      applyAppearance();
      updateControls();
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch {}
    }
    toggle.addEventListener('change', () => {
      preferences.dark = toggle.checked;
      saveAppearance();
    });
    picker.addEventListener('input', () => {
      if (!validColor(picker.value)) return;
      preferences.color = picker.value;
      saveAppearance();
    });
    for (const preset of presets) preset.addEventListener('click', () => {
      preferences.color = preset.dataset.contrastColor;
      saveAppearance();
    });
    updateControls();
  });
})();
