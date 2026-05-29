/**
 * CNSPK · MembershipForm
 * ----------------------------------------------------------
 * Brand-styled membership form rendered as a modal. Submits
 * to a Google Form (configured in membership-config.js). On
 * success, the member lands in the linked Google Sheet and
 * shows up on the members map on the next load.
 *
 * Submission method: a hidden <iframe> target so the POST to
 * Google doesn't navigate the page away (Google Forms has no
 * CORS for fetch; the iframe technique is the standard
 * static-site approach). We can't read Google's response, so
 * we treat a completed submit as success and show a thank-you.
 *
 * Degrades gracefully: if MEMBERSHIP.enabled is false or the
 * form URL is blank, the modal shows a "coming soon" notice
 * instead of a broken form.
 *
 * Usage:
 *   const f = new MembershipForm();
 *   f.init('membership-form-mount');   // a container div id
 *   f.open();                          // open the modal
 * ----------------------------------------------------------
 */

import { MEMBERSHIP } from './membership-config.js';

export class MembershipForm {
  constructor() {
    this.mountId = null;
    this.cfg = MEMBERSHIP;
    this.cities = [];   // loaded from pakistan-cities.json for the search datalist
  }

  init(mountId) {
    this.mountId = mountId;
    this.injectStyles();
    this.loadCities();   // async; datalist fills in when ready
    this.render();
    this.bind();
  }

  /** Load the city list for the search datalist (non-blocking). */
  async loadCities() {
    try {
      const res = await fetch('../data/pakistan-cities.json');
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      this.cities = (data.cities || [])
        .map(c => c.name)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      this.fillCityDatalist();
    } catch (err) {
      // Fall back to the provincial capitals if the dataset is unavailable.
      this.cities = ['Islamabad', 'Lahore', 'Karachi', 'Peshawar', 'Quetta', 'Gilgit', 'Muzaffarabad'];
      this.fillCityDatalist();
    }
  }

  fillCityDatalist() {
    const dl = document.getElementById('cnspk-city-list');
    if (dl) dl.innerHTML = this.cities.map(c => `<option value="${c}"></option>`).join('');
  }

  injectStyles() {
    if (document.getElementById('cnspk-membership-form-styles')) return;
    const style = document.createElement('style');
    style.id = 'cnspk-membership-form-styles';
    style.textContent = `
      .cnspk-mf__overlay {
        position: fixed; inset: 0; z-index: 1000;
        display: none; align-items: center; justify-content: center;
        background: rgba(15, 17, 21, 0.78);
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        padding: 24px;
      }
      .cnspk-mf__overlay[data-open="true"] { display: flex; }
      .cnspk-mf__dialog {
        width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto;
        background: var(--charcoal); border: 1px solid var(--slate);
        border-radius: var(--r-lg); padding: 32px;
        position: relative; box-shadow: var(--shadow-elevated);
      }
      .cnspk-mf__dialog::before {
        content: ''; position: absolute; top: 0; left: 0;
        width: 4px; height: 100%; background: var(--grad-stamp-glow);
        border-radius: var(--r-lg) 0 0 var(--r-lg);
      }
      .cnspk-mf__close {
        position: absolute; top: 16px; right: 16px;
        width: 36px; height: 36px; border-radius: var(--r-sm);
        border: 1px solid var(--slate); color: var(--steel);
        display: grid; place-items: center; cursor: pointer;
        transition: color var(--dur-hover) var(--ease), border-color var(--dur-hover) var(--ease);
      }
      .cnspk-mf__close:hover { color: var(--lime); border-color: var(--lime); }
      .cnspk-mf__eyebrow {
        font-family: var(--font-mono); font-size: 11px; color: var(--lime);
        letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 12px;
      }
      .cnspk-mf__title {
        font-family: var(--font-display); font-style: italic; font-weight: 800;
        text-transform: uppercase; font-size: 30px; line-height: 0.95;
        letter-spacing: -0.03em; color: var(--bone); margin-bottom: 10px;
      }
      .cnspk-mf__sub { font-size: 14px; color: var(--bone-2); line-height: 1.55; margin-bottom: 24px; }
      .cnspk-mf__field { margin-bottom: 16px; }
      .cnspk-mf__label {
        display: block; font-family: var(--font-mono); font-size: 12px;
        color: var(--steel); letter-spacing: 0.04em; text-transform: uppercase;
        margin-bottom: 6px;
      }
      .cnspk-mf__label .req { color: var(--lime); }
      .cnspk-mf__input, .cnspk-mf__select {
        width: 100%; background: var(--carbon); border: 1px solid var(--slate);
        border-radius: var(--r-sm); padding: 12px 14px; color: var(--bone);
        font-family: var(--font-body); font-size: 15px; outline: none;
        transition: border-color var(--dur-hover) var(--ease);
      }
      .cnspk-mf__input::placeholder { color: var(--steel); }
      .cnspk-mf__input:focus-visible, .cnspk-mf__select:focus-visible {
        border-color: var(--lime); outline: 2px solid rgba(199,255,62,0.25); outline-offset: 1px;
      }
      .cnspk-mf__consent {
        display: flex; gap: 10px; align-items: flex-start;
        font-size: 13px; color: var(--bone-2); line-height: 1.5;
        margin: 20px 0; cursor: pointer;
      }
      .cnspk-mf__consent-group {
        margin: 20px 0; padding: 16px; border: 1px solid var(--slate);
        border-radius: var(--r-sm); background: var(--carbon);
      }
      .cnspk-mf__consent-group .cnspk-mf__consent { margin: 0 0 12px; }
      .cnspk-mf__consent-group .cnspk-mf__consent:last-child { margin-bottom: 0; }
      .cnspk-mf__consent input { margin-top: 3px; accent-color: var(--lime); width: 16px; height: 16px; flex-shrink: 0; }
      .cnspk-mf__submit { width: 100%; justify-content: center; }
      .cnspk-mf__notice {
        font-family: var(--font-mono); font-size: 13px; color: var(--bone-2);
        line-height: 1.6; padding: 20px; border: 1px dashed var(--slate);
        border-radius: var(--r-sm); background: var(--carbon);
      }
      .cnspk-mf__notice a { color: var(--lime); }
      .cnspk-mf__success { text-align: center; padding: 16px 0; }
      .cnspk-mf__success .check {
        width: 56px; height: 56px; border-radius: 50%;
        background: rgba(199,255,62,0.12); border: 1px solid rgba(199,255,62,0.4);
        color: var(--lime); display: grid; place-items: center; margin: 0 auto 18px;
        font-size: 26px;
      }
      .cnspk-mf__success h3 {
        font-family: var(--font-display); font-style: italic; font-weight: 800;
        text-transform: uppercase; font-size: 24px; color: var(--bone);
        letter-spacing: -0.02em; margin-bottom: 8px;
      }
      .cnspk-mf__success p { font-size: 14px; color: var(--bone-2); line-height: 1.55; }
      .cnspk-mf__err { color: var(--breach); font-family: var(--font-mono); font-size: 12px; margin-top: 8px; min-height: 16px; }
    `;
    document.head.appendChild(style);
  }

  /** Career-stage roles (mirrors the Apps Script). */
  roleOptions() {
    return ['Student', 'Junior Engineer (0–2 yrs)', 'Engineer (3–5 yrs)',
      'Senior Engineer (6–10 yrs)', 'Staff / Principal (10+ yrs)',
      'Security Lead / CISO', 'Founder / Freelancer', 'Other'];
  }

  render() {
    const mount = document.getElementById(this.mountId);
    if (!mount) return;

    const live = this.cfg.enabled && this.cfg.formActionUrl;

    const closeBtn = `
      <button class="cnspk-mf__close" id="cnspk-mf-close" type="button" aria-label="Close form">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;

    const head = `
      <div class="cnspk-mf__eyebrow">// cnspk membership</div>
      <h2 class="cnspk-mf__title">Join the chapter.</h2>
      <p class="cnspk-mf__sub">Register once and you get a <strong style="color:var(--bone)">membership number</strong>, emailed to you. Appearing on the public map is optional — your call below. <em>Bharosa.</em></p>`;

    const roleOpts = this.roleOptions().map(r => `<option value="${r}">${r}</option>`).join('');
    const featureText = this.cfg.featureOptionText || 'Yes — feature me on the CNSPK website and members map';
    const shareText = this.cfg.shareOptionText || 'Yes — CNSPK may share my details with partner organizations for hiring and internships';

    const form = live ? `
      <form id="cnspk-mf-form" novalidate>
        <div class="cnspk-mf__field">
          <label class="cnspk-mf__label" for="mf-name">Full name <span class="req">*</span></label>
          <input class="cnspk-mf__input" id="mf-name" type="text" required placeholder="Your name" autocomplete="name">
        </div>
        <div class="cnspk-mf__field">
          <label class="cnspk-mf__label" for="mf-email">Email <span class="req">*</span></label>
          <input class="cnspk-mf__input" id="mf-email" type="email" required placeholder="you@domain.pk" autocomplete="email">
          <span style="font-size:11px;color:var(--steel);font-family:var(--font-mono)">// where we send your membership number — kept private, never shown</span>
        </div>
        <div class="cnspk-mf__field">
          <label class="cnspk-mf__label" for="mf-city">City <span class="req">*</span></label>
          <input class="cnspk-mf__input" id="mf-city" type="text" required
            list="cnspk-city-list" autocomplete="off"
            placeholder="Type to search — e.g. Lahore, Multan, Gwadar…">
          <datalist id="cnspk-city-list"></datalist>
          <span style="font-size:11px;color:var(--steel);font-family:var(--font-mono)">// search any Pakistani city — or just type yours if it's not listed</span>
        </div>
        <div class="cnspk-mf__field">
          <label class="cnspk-mf__label" for="mf-role">Role / career stage <span class="req">*</span></label>
          <select class="cnspk-mf__select" id="mf-role" required>
            <option value="" disabled selected>Pick one</option>
            ${roleOpts}
          </select>
        </div>
        <div class="cnspk-mf__field">
          <label class="cnspk-mf__label" for="mf-org">Organization / University <span style="opacity:.6">(optional)</span></label>
          <input class="cnspk-mf__input" id="mf-org" type="text" placeholder="e.g. NUST / Systems Limited">
        </div>
        <div class="cnspk-mf__field">
          <label class="cnspk-mf__label" for="mf-interests">Interests <span style="opacity:.6">(comma-separated, optional)</span></label>
          <input class="cnspk-mf__input" id="mf-interests" type="text" placeholder="Kubernetes, DevSecOps, Supply Chain">
        </div>
        <div class="cnspk-mf__field">
          <label class="cnspk-mf__label" for="mf-github">GitHub <span style="opacity:.6">(optional)</span></label>
          <input class="cnspk-mf__input" id="mf-github" type="url" placeholder="https://github.com/you">
        </div>
        <div class="cnspk-mf__field">
          <label class="cnspk-mf__label" for="mf-linkedin">LinkedIn <span style="opacity:.6">(optional)</span></label>
          <input class="cnspk-mf__input" id="mf-linkedin" type="url" placeholder="https://linkedin.com/in/you">
        </div>

        <div class="cnspk-mf__consent-group">
          <label class="cnspk-mf__consent">
            <input type="checkbox" id="mf-feature">
            <span>${featureText.replace(/^Yes\s*[—-]\s*/, '')} <span style="color:var(--steel)">(optional — leave off to stay a private member)</span></span>
          </label>
          <label class="cnspk-mf__consent">
            <input type="checkbox" id="mf-share">
            <span>${shareText.replace(/^Yes\s*[—-]\s*/, '')} <span style="color:var(--steel)">(optional — internships &amp; hiring)</span></span>
          </label>
        </div>

        <button class="btn-primary cnspk-mf__submit" type="submit" id="mf-submit">
          Register &amp; get my number
          <span style="font-family:var(--font-mono);">→</span>
        </button>
        <p class="cnspk-mf__err" id="mf-err" role="alert"></p>
      </form>` : `
      <div class="cnspk-mf__notice">
        // membership registration goes live once the chapter's Google Form is wired up
        (see MEMBERSHIP_SETUP.md).<br><br>
        For now, join through any door on the <a href="/join/">join page</a> — WhatsApp, the CNCF chapter, or GitHub.
      </div>`;

    mount.innerHTML = `
      <div class="cnspk-mf__overlay" id="cnspk-mf-overlay" role="dialog" aria-modal="true" aria-label="CNSPK membership form">
        <div class="cnspk-mf__dialog">
          ${closeBtn}
          <div id="cnspk-mf-body">
            ${head}
            ${form}
          </div>
        </div>
      </div>
      <iframe name="cnspk-mf-sink" id="cnspk-mf-sink" style="display:none" title="form sink"></iframe>`;

    // Populate the city search list (cities may have loaded before render).
    this.fillCityDatalist();
  }

  bind() {
    this.overlay = document.getElementById('cnspk-mf-overlay');
    const closeBtn = document.getElementById('cnspk-mf-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    if (this.overlay) {
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) this.close();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay?.dataset.open === 'true') this.close();
    });

    const form = document.getElementById('cnspk-mf-form');
    if (form) form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  open() {
    if (this.overlay) {
      this.overlay.dataset.open = 'true';
      document.body.style.overflow = 'hidden';
      const first = document.getElementById('mf-name');
      if (first) setTimeout(() => first.focus(), 50);
    }
  }

  close() {
    if (this.overlay) {
      this.overlay.dataset.open = 'false';
      document.body.style.overflow = '';
    }
  }

  handleSubmit(e) {
    e.preventDefault();
    const err = document.getElementById('mf-err');
    err.textContent = '';

    const f = this.cfg.formFields;
    const val = (id) => (document.getElementById(id)?.value || '').trim();

    const name = val('mf-name');
    const email = val('mf-email');
    const city = val('mf-city');
    const role = val('mf-role');
    const featured = document.getElementById('mf-feature')?.checked;
    const shared = document.getElementById('mf-share')?.checked;

    // Compulsory core fields
    if (!name) { err.textContent = 'Name is required.'; return; }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = 'A valid email is required — that\'s where your membership number goes.'; return; }
    if (!city) { err.textContent = 'Please type or pick your city.'; return; }
    if (!role) { err.textContent = 'Please pick your role / career stage.'; return; }

    // Build the Google Form POST
    const gForm = document.createElement('form');
    gForm.action = this.cfg.formActionUrl;
    gForm.method = 'POST';
    gForm.target = 'cnspk-mf-sink';
    gForm.style.display = 'none';

    const add = (entryId, value) => {
      if (!entryId || /entry\.0+$/.test(entryId) || value === '' || value == null) return;
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = entryId;
      input.value = value;
      gForm.appendChild(input);
    };

    add(f.name, name);
    add(f.email, email);
    add(f.city, city);
    add(f.role, role);
    add(f.org, val('mf-org'));
    add(f.interests, val('mf-interests'));
    add(f.github, val('mf-github'));
    add(f.linkedin, val('mf-linkedin'));
    // Checkboxes submit their EXACT option label as the value.
    if (featured) add(f.feature, this.cfg.featureOptionText);
    if (shared) add(f.share, this.cfg.shareOptionText);

    document.body.appendChild(gForm);
    gForm.submit();
    document.body.removeChild(gForm);

    this.showSuccess(name, city, featured);
  }

  showSuccess(name, city, featured) {
    const body = document.getElementById('cnspk-mf-body');
    if (!body) return;
    const mapLine = featured
      ? `Your pin appears on the members map shortly. See you in ${city}.`
      : `You're a private member — not on the public map. You can ask to be featured any time.`;
    body.innerHTML = `
      <div class="cnspk-mf__success">
        <div class="check" aria-hidden="true">✓</div>
        <h3>You're registered.</h3>
        <p><strong style="color:var(--bone)">${name}</strong> — welcome to CNSPK. Your <strong style="color:var(--lime)">membership number</strong> is on its way to your email.</p>
        <p style="margin-top:10px">${mapLine}</p>
        <p style="margin-top:16px;font-family:var(--font-mono);font-size:12px;color:var(--steel)">kubectl apply -f pakistan.yaml</p>
      </div>`;
  }
}
