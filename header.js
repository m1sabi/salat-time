// header.js
class SiteHeader extends HTMLElement {
  connectedCallback() {
    // Attr overrides (optional)
    let primaryLabel = this.getAttribute('primary-label');
    let primaryHref  = (this.getAttribute('primary-href') || '').toLowerCase();
    const homeLabel  = this.getAttribute('home-label') || 'الصفحة الرئيسية';
    const homeHref   = this.getAttribute('home-href')  || 'index.html';

    // Current file (no query/hash)
    const file = (location.pathname.match(/[^/]+$/) || [''])[0].toLowerCase();

    // Page groups (for sensible defaults)
    const RESOURCES_PAGES = new Set([
      'resources.html','about-makka.html','fatwa-1hour5min.html',
      'sh-zarka.html','high-latitudes.html'
    ]);
    const SETTINGS_PAGES = new Set(['settings.html','browser-settings.html']);

    // Defaults when attrs not provided
    if (!primaryLabel || !primaryHref) {
      if (RESOURCES_PAGES.has(file)) {
        primaryLabel = 'مراجع ومواد';
        primaryHref  = 'resources.html';
      } else if (SETTINGS_PAGES.has(file)) {
        primaryLabel = 'الإعدادات';
        primaryHref  = 'settings.html';
      } else {
        primaryLabel = primaryLabel || 'الإعدادات';
        primaryHref  = primaryHref  || 'settings.html';
      }
    }

    // AUTO-HIDE: if primary points to the current page, don’t render it
    const hidePrimaryBecauseSelf = primaryHref === file;

    this.innerHTML = `
      <header class="page-header" role="banner">
        <nav class="links-group" aria-label="روابط التنقل">
          ${hidePrimaryBecauseSelf ? '' : `<a class="back" href="${primaryHref}">${primaryLabel}</a>`}
          <a class="back" href="${homeHref}">${homeLabel}</a>
        </nav>
      </header>
    `;
  }
}
customElements.define('site-header', SiteHeader);
