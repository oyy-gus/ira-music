'use strict';

let allCmds = [];
let activeCat = 'all';

fetch('/api/commands')
  .then(r => r.json())
  .then(d => {
    allCmds = d.commands || [];
    populateCategories(allCmds);
    doFilter();
  })
  .catch(() => {});

function populateCategories(commands) {
  const select = document.getElementById('cmd-category-select');
  if (!select) return;

  const catCounts = {};
  commands.forEach(c => {
    const cat = c.category || 'general';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });

  const categories = Object.keys(catCounts).sort();
  select.innerHTML = '<option value="all">All Categories (' + commands.length + ')</option>' +
    categories.map(cat => {
      const label = cat.charAt(0).toUpperCase() + cat.slice(1);
      return `<option value="${cat}">${label} (${catCounts[cat]})</option>`;
    }).join('');
}

function onCategoryChange(cat) {
  activeCat = cat;
  doFilter();
}

function doFilter() {
  const searchInput = document.getElementById('cmd-search');
  const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const prefix = '*';

  const filtered = allCmds.filter(c => {
    const mc = activeCat === 'all' || c.category === activeCat;
    const nameMatch = c.name && c.name.toLowerCase().includes(q);
    const descMatch = c.description && c.description.toLowerCase().includes(q);
    const aliasMatch = c.aliases && c.aliases.some(a => a.toLowerCase().includes(q));
    const mq = !q || nameMatch || descMatch || aliasMatch;
    return mc && mq;
  });

  const grid = document.getElementById('cmd-grid');
  const empty = document.getElementById('cmd-empty');
  const catColors = { music: 'chip-blue', utility: 'chip-pink', moderation: 'chip-red', general: 'chip-green' };

  if (!grid) return;

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  grid.innerHTML = filtered.map(c => `
    <div class="cmd-card">
      <div class="cmd-head">
        <span class="cmd-name">${prefix}${c.name}</span>
        <span class="chip ${catColors[c.category] || 'chip-blue'}">${c.category || 'general'}</span>
      </div>
      <div class="cmd-desc">${c.description || 'No description available.'}</div>
      ${c.aliases && c.aliases.length ? '<div class="cmd-aliases">Aliases: ' + c.aliases.map(a => '<code>' + a + '</code>').join(', ') + '</div>' : ''}
    </div>
  `).join('');
}
