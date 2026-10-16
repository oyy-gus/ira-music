'use strict';

function switchLbTab(tab) {
  const uBtn = document.getElementById('lb-tab-users');
  const sBtn = document.getElementById('lb-tab-servers');
  const uSec = document.getElementById('sec-users');
  const sSec = document.getElementById('sec-servers');

  if (!uBtn || !sBtn || !uSec || !sSec) return;

  if (tab === 'users') {
    uBtn.className = 'btn btn-primary btn-sm';
    sBtn.className = 'btn btn-secondary btn-sm';
    uSec.style.display = 'block';
    sSec.style.display = 'none';
  } else {
    sBtn.className = 'btn btn-primary btn-sm';
    uBtn.className = 'btn btn-secondary btn-sm';
    sSec.style.display = 'block';
    uSec.style.display = 'none';
  }
}
