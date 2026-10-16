'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburgerBtn');
  const drawer = document.getElementById('navDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  const closeBtn = document.getElementById('drawerCloseBtn');

  const openDrawer = () => {
    if (hamburger) hamburger.classList.add('open');
    if (drawer) drawer.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  const closeDrawer = () => {
    if (hamburger) hamburger.classList.remove('open');
    if (drawer) drawer.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    document.body.style.overflow = '';
  };

  if (hamburger) hamburger.addEventListener('click', () => {
    if (drawer && drawer.classList.contains('open')) closeDrawer(); else openDrawer();
  });
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);

  initCustomSelects();
});

// ── CUSTOM DROPDOWN OVERLAY SYSTEM ──────────────────────────────────────────
function initCustomSelects() {
  const selects = document.querySelectorAll('select.form-select:not([data-cselect-init])');
  selects.forEach(select => {
    select.setAttribute('data-cselect-init', 'true');
    select.classList.add('cselect-native-hidden');

    const wrapper = document.createElement('div');
    wrapper.className = 'cselect-wrapper';
    if (select.id) wrapper.setAttribute('data-target-id', select.id);

    const trigger = document.createElement('div');
    trigger.className = 'cselect-trigger';
    trigger.setAttribute('tabindex', '0');

    const textSpan = document.createElement('span');
    textSpan.className = 'cselect-text';

    const arrowIcon = document.createElement('i');
    arrowIcon.className = 'fa-solid fa-chevron-down cselect-arrow';

    trigger.appendChild(textSpan);
    trigger.appendChild(arrowIcon);

    const dropdown = document.createElement('div');
    dropdown.className = 'cselect-dropdown';

    wrapper.appendChild(trigger);
    wrapper.appendChild(dropdown);

    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    function renderOptions() {
      dropdown.innerHTML = '';
      const options = Array.from(select.options);
      const selectedOpt = select.options[select.selectedIndex];
      textSpan.textContent = selectedOpt ? selectedOpt.textContent : '-- Select --';

      options.forEach(opt => {
        const item = document.createElement('div');
        const isSelected = opt.selected || opt.value === select.value;
        item.className = 'cselect-option' + (isSelected ? ' cselect-selected' : '');
        item.setAttribute('data-value', opt.value);

        const label = document.createElement('span');
        label.textContent = opt.textContent;
        item.appendChild(label);

        if (isSelected) {
          const check = document.createElement('i');
          check.className = 'fa-solid fa-check cselect-check';
          item.appendChild(check);
        }

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          select.dispatchEvent(new Event('input', { bubbles: true }));
          updateSelected();
          closeAllCustomSelects();
        });

        dropdown.appendChild(item);
      });
    }

    function updateSelected() {
      const selectedOpt = select.options[select.selectedIndex];
      textSpan.textContent = selectedOpt ? selectedOpt.textContent : '-- Select --';
      Array.from(dropdown.children).forEach(item => {
        const isMatch = item.getAttribute('data-value') === select.value;
        item.classList.toggle('cselect-selected', isMatch);
        const existingCheck = item.querySelector('.cselect-check');
        if (isMatch && !existingCheck) {
          const check = document.createElement('i');
          check.className = 'fa-solid fa-check cselect-check';
          item.appendChild(check);
        } else if (!isMatch && existingCheck) {
          existingCheck.remove();
        }
      });
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = wrapper.classList.contains('open');
      closeAllCustomSelects();
      if (!isOpen) {
        wrapper.classList.add('open');
      }
    });

    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        trigger.click();
      } else if (e.key === 'Escape') {
        closeAllCustomSelects();
      }
    });

    select.addEventListener('change', updateSelected);

    const observer = new MutationObserver(() => {
      renderOptions();
    });
    observer.observe(select, { childList: true, subtree: true, attributes: true });

    renderOptions();
  });
}

function closeAllCustomSelects() {
  document.querySelectorAll('.cselect-wrapper.open').forEach(w => w.classList.remove('open'));
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.cselect-wrapper')) {
    closeAllCustomSelects();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllCustomSelects();
});

window.initCustomSelects = initCustomSelects;
window.closeAllCustomSelects = closeAllCustomSelects;
