(function () {
  'use strict';

  var SYSTEM_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, "Helvetica Neue", Arial, sans-serif';
  var STACKS = {
    sans: SYSTEM_STACK,
    serif: 'Georgia, "Times New Roman", "Iowan Old Style", serif',
    mono: '"SF Mono", Consolas, "Liberation Mono", "Courier New", monospace',
    display: 'Impact, "Arial Black", "Helvetica Neue", sans-serif',
    bebas: '"Bebas Neue", Impact, "Arial Narrow", sans-serif',
    oswald: 'Oswald, "Helvetica Neue", Arial, sans-serif',
    pacifico: 'Pacifico, "Brush Script MT", cursive',
    caveat: 'Caveat, "Comic Sans MS", cursive',
    marker: '"Permanent Marker", "Comic Sans MS", cursive',
    playfair: '"Playfair Display", Georgia, "Times New Roman", serif',
    lobster: 'Lobster, "Brush Script MT", cursive',
    inter: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    montserrat: 'Montserrat, "Helvetica Neue", Arial, sans-serif'
  };

  function token(value) {
    var key = String(value || 'sans').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(STACKS, key) ? key : 'sans';
  }

  function stack(value) {
    return STACKS[token(value)] || SYSTEM_STACK;
  }

  function applyBrandFont(value, target) {
    var node = target || document.documentElement;
    if (!node || !node.style || !node.style.setProperty) return stack(value);
    var family = stack(value);
    node.style.setProperty('--brand-font', family);
    node.setAttribute('data-brand-font', token(value));
    return family;
  }

  window.IRLID_BRAND_FONT_STACKS = STACKS;
  window.IRLID_SYSTEM_FONT_STACK = SYSTEM_STACK;
  window.IRLID_BRAND_FONT_TOKEN = token;
  window.IRLID_BRAND_FONT_STACK = stack;
  window.IRLID_APPLY_BRAND_FONT = applyBrandFont;
}());
