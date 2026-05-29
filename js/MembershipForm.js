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
  }

  init(mountId) {
    this.mountId = mountId;
    this.injectStyles();
    this.render();
    this.bind();
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

  /** The list of Pakistani cities for the dropdown (mirrors city-coords.json keys). */
  cityOptions() {
    return ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan',
      'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala', 'Hyderabad', 'Bahawalpur',
      'Abbottabad', 'Sargodha', 'Other Pakistan', 'Diaspora'];
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
      <div class="cnspk-mf__eyebrow">// add yourself to the map</div>
      <h2 class="cnspk-mf__title">Put your pin on it.</h2>
      <p class="cnspk-mf__sub">Fill this in and you'll appear on the members map. Real engineers, real cities, no gatekeeping. <em>Bharosa</em> — your details are only used for the public directory.</p>`;

    const cityOpts = this.cityOptions().map(c => `<option value="${c}">${c}</option>`).join('');

    const form = live ? `
      <form id="cnspk-mf-form" novalidate>
        <div class="cnspk-mf__field">
          <label class="cnspk-mf__label" for="mf-name">Name <span class="req">*</span></label>
          <input class="cnspk-mf__input" id="mf-name" name="name" type="text" required placeholder="Your name" autocomplete="name">
        </div>
        <div class="cnspk-mf__field">
          <label class="cnspk-mf__label" for="mf-role">Role / title</label>
          <input class="cnspk-mf__input" id="mf-role" name="role" type="text" placeholder="e.g. DevSecOps Engineer @ Company">
        </div>
        <div class="cnspk-mf__field">
          <label class="cnspk-mf__label" for="mf-city">City <span class="req">*</span></label>
          <select class="cnspk-mf__select" id="mf-city" name="city" required>
            <option value="" disabled selected>Pick your city</option>
            ${cityOpts}
          </select>
        </div>
        <div class="cnspk-mf__field">
          <label class="cnspk-mf__label" for="mf-interests">Interests <span style="opacity:.6">(comma-separated)</span></label>
          <input class="cnspk-mf__input" id="mf-interests" name="interests" type="text" placeholder="Kubernetes, DevSecOps, Supply Chain">
        </div>
        <div class="cnspk-mf__field">
          <label class="cnspk-mf__label" for="mf-github">GitHub <span style="opacity:.6">(optional)</span></label>
          <input class="cnspk-mf__input" id="mf-github" name="github" type="url" placeholder="https://github.com/you">
        </div>
        <div class="cnspk-mf__field">
          <label class="cnspk-mf__label" for="mf-linkedin">LinkedIn <span style="opacity:.6">(optional)</span></label>
          <input class="cnspk-mf__input" id="mf-linkedin" name="linkedin" type="url" placeholder="https://linkedin.com/in/you">
        </div>
        <label class="cnspk-mf__consent">
          <input type="checkbox" id="mf-consent" name="consent" required>
          <span>I agree to have my name, role, and city shown on the public CNSPK members map and directory.</span>
        </label>
        <button class="btn-primary cnspk-mf__submit" type="submit" id="mf-submit">
          Add me to the map
          <span style="font-family:var(--font-mono);">→</span>
        </button>
        <p class="cnspk-mf__err" id="mf-err" role="alert"></p>
      </form>` : `
      <div class="cnspk-mf__notice">
        // membership form goes live once the chapter's Google Form is wired up.<br><br>
        For now, join through any door on the <a href="/join/">join page</a> — WhatsApp, the CNCF chapter, or GitHub.
      </div>`;

    mount.innerHTML = `
      <div class="cnspk-mf__overlay" id="cnspk-mf-overlay" role="dialog" aria-modal="true" aria-label="Membership form">
        <div class="cnspk-mf__dialog">
          ${closeBtn}
          <div id="cnspk-mf-body">
            ${head}
            ${form}
          </div>
        </div>
      </div>
      <!-- Hidden submit target so the Google POST doesn't navigate away -->
      <iframe name="cnspk-mf-sink" id="cnspk-mf-sink" style="display:none" title="form sink"></iframe>`;
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
    const city = val('mf-city');
    const consent = document.getElementById('mf-consent')?.checked;

    if (!name) { err.textContent = 'Name is required.'; return; }
    if (!city) { err.textContent = 'Please pick your city.'; return; }
    if (!consent) { err.textContent = 'Please tick the consent box — your details go on a public map.'; return; }

    // Build a hidden Google Form POST using the configured entry.* field ids.
    const gForm = document.createElement('form');
    gForm.action = this.cfg.formActionUrl;
    gForm.method = 'POST';
    gForm.target = 'cnspk-mf-sink';
    gForm.style.display = 'none';

    const add = (entryId, value) => {
      if (!entryId || /entry\.0+$/.test(entryId)) return; // skip unconfigured placeholders
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = entryId;
      input.value = value;
      gForm.appendChild(input);
    };

    add(f.name, name);
    add(f.role, val('mf-role'));
    add(f.city, city);
    add(f.interests, val('mf-interests'));
    add(f.github, val('mf-github'));
    add(f.linkedin, val('mf-linkedin'));
    add(f.consent, 'Yes');

    document.body.appendChild(gForm);
    gForm.submit();
    document.body.removeChild(gForm);

    this.showSuccess(name, city);
  }

  showSuccess(name, city) {
    const body = document.getElementById('cnspk-mf-body');
    if (!body) return;
    body.innerHTML = `
      <div class="cnspk-mf__success">
        <div class="check" aria-hidden="true">✓</div>
        <h3>You're on the map.</h3>
        <p><strong style="color:var(--bone)">${name}</strong> — welcome to CNSPK. Your pin will appear on the members map shortly (after the next refresh). See you in ${city}.</p>
        <p style="margin-top:16px;font-family:var(--font-mono);font-size:12px;color:var(--steel)">kubectl apply -f pakistan.yaml</p>
      </div>`;
  }
}
