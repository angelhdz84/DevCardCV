// core/ui.js — Componentes UI reutilizables
const UI = {
  toast(message, type = 'info') {
    const icons = {
      success: 'bi-check-circle-fill',
      error: 'bi-exclamation-triangle-fill',
      warning: 'bi-exclamation-circle-fill',
      info: 'bi-info-circle-fill'
    };
    const colors = {
      success: 'alert-success',
      error: 'alert-error',
      warning: 'alert-warning',
      info: 'alert-info'
    };

    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `alert ${colors[type]}`;
    toast.style.cssText = `
      max-width: 360px;
      border-radius: 10px;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.06);
      animation: toastIn 0.2s ease;
      font-size: 0.8125rem;
      font-weight: 500;
      padding: 0.625rem 0.875rem;
    `;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `<i class="bi ${icons[type]} text-sm"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-4px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  },

  confirm(message, title = 'Confirmar') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal modal-open';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.style.background = 'rgba(0,0,0,0.3)';
      overlay.innerHTML = `
        <div class="modal-box" style="max-width: 400px; border-radius: 12px;">
          <h3 class="font-semibold text-base tracking-heading flex items-center gap-2">
            <i class="bi bi-question-circle text-accent"></i> ${title}
          </h3>
          <p class="py-3 text-sm text-base-content/60 leading-relaxed">${message}</p>
          <div class="modal-action">
            <button class="btn btn-ghost btn-sm" id="modal-cancel" style="border-radius: 8px;">Cancelar</button>
            <button class="btn btn-primary btn-sm" id="modal-ok" style="border-radius: 8px;">Confirmar</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const okBtn = overlay.querySelector('#modal-ok');
      const cancelBtn = overlay.querySelector('#modal-cancel');
      okBtn.focus();

      okBtn.onclick = () => { overlay.remove(); resolve(true); };
      cancelBtn.onclick = () => { overlay.remove(); resolve(false); };
      overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
      overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') { overlay.remove(); resolve(false); } });
    });
  },

  formatDate(date, format = 'DD/MM/YYYY') {
    if (!date) return '';
    return dayjs(date).format(format);
  },

  formatDateRelative(date) {
    if (!date) return '';
    const d = dayjs(date);
    const now = dayjs();
    const diff = now.diff(d, 'day');
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    if (diff < 7) return `Hace ${diff} días`;
    if (diff < 30) return `Hace ${Math.floor(diff / 7)} sem.`;
    if (diff < 365) return `Hace ${Math.floor(diff / 30)} mes${Math.floor(diff / 30) > 1 ? 'es' : ''}`;
    return `Hace ${Math.floor(diff / 365)} año${Math.floor(diff / 365) > 1 ? 's' : ''}`;
  },

  showLoading(containerId, message = 'Cargando...') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
      <div class="space-y-4" style="padding: 0.25rem 0;">
        <div class="card bg-white overflow-hidden">
          <div class="card-body p-5">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-lg skeleton-shimmer"></div>
              <div class="flex-1 space-y-2.5">
                <div class="h-4 skeleton-shimmer" style="width: 35%;"></div>
                <div class="h-3 skeleton-shimmer" style="width: 25%;"></div>
              </div>
            </div>
            <div class="mt-4 space-y-2.5">
              <div class="h-3 skeleton-shimmer w-full"></div>
              <div class="h-3 skeleton-shimmer" style="width: 65%;"></div>
            </div>
            <div class="flex gap-2 mt-4">
              <div class="h-5 skeleton-shimmer" style="width: 5rem;"></div>
              <div class="h-5 skeleton-shimmer" style="width: 4rem;"></div>
              <div class="h-5 skeleton-shimmer" style="width: 6rem;"></div>
            </div>
          </div>
        </div>
        <div class="card bg-white overflow-hidden">
          <div class="card-body p-5">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-lg skeleton-shimmer"></div>
              <div class="flex-1 space-y-2.5">
                <div class="h-4 skeleton-shimmer" style="width: 40%;"></div>
                <div class="h-3 skeleton-shimmer" style="width: 30%;"></div>
              </div>
            </div>
            <div class="mt-4 space-y-2.5">
              <div class="h-3 skeleton-shimmer w-full"></div>
              <div class="h-3 skeleton-shimmer" style="width: 55%;"></div>
            </div>
            <div class="flex gap-2 mt-4">
              <div class="h-5 skeleton-shimmer" style="width: 4.5rem;"></div>
              <div class="h-5 skeleton-shimmer" style="width: 5.5rem;"></div>
              <div class="h-5 skeleton-shimmer" style="width: 3.5rem;"></div>
            </div>
          </div>
        </div>
      </div>
      <p class="text-center text-xs" style="color: var(--ink-muted); margin-top: 0.75rem;">${message}</p>
    `;
  },

  emptyState(message, icon = 'bi-inbox', action = null) {
    let actionHtml = '';
    if (action) {
      actionHtml = `<button class="btn btn-primary btn-sm mt-5" style="border-radius: 8px;" onclick="${action.handler}">
        <i class="bi ${action.icon || 'bi-plus-lg'}"></i> ${action.label}
      </button>`;
    }
    return `
      <div class="flex flex-col items-center justify-center py-24 stagger-enter" style="animation-delay: 0s;">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" class="mb-5" style="opacity: 0.35;">
          <rect x="12" y="20" width="56" height="48" rx="8" stroke="currentColor" stroke-width="2" fill="none"/>
          <line x1="22" y1="36" x2="58" y2="36" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="22" y1="46" x2="48" y2="46" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="22" y1="56" x2="38" y2="56" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="60" cy="20" r="10" fill="currentColor" opacity="0.15"/>
        </svg>
        <div class="w-14 h-14 rounded-2xl bg-base-200 flex items-center justify-center mb-4" style="display: none;">
          <i class="bi ${icon} text-3xl text-base-content/20"></i>
        </div>
        <h3 class="text-sm font-medium" style="color: var(--ink-muted);">${message}</h3>
        ${actionHtml}
      </div>
    `;
  },

  focusTrap(container) {
    const focusable = container.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const handler = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    container.addEventListener('keydown', handler);
    first.focus();
    return handler;
  }
};

window.UI = UI;
