/*
  Small centered modals (shortcuts, jump to patient). Native <dialog> for
  inertness and Escape, plus: an animated open and close, a Tab wrap, backdrop
  clicks, and focus handed back to whatever opened it.
*/
(function () {
  const SH = (window.SH = window.SH || {});

  const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function trapTab(dlg, e) {
    if (e.key !== "Tab") return;
    const items = [...dlg.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function open(dlg, { focus } = {}) {
    if (dlg.open) return;
    dlg._returnTo = document.activeElement;
    dlg.showModal();
    void dlg.offsetWidth; // commit the start state so the transition runs
    dlg.classList.add("is-open");
    (focus ? dlg.querySelector(focus) : dlg.querySelector(FOCUSABLE))?.focus();
  }

  /* restore: false when the modal hands off to something else (like the drawer). */
  function close(dlg, { restore = true } = {}) {
    if (!dlg.open || dlg._closing) return;
    dlg._closing = true;
    dlg.classList.remove("is-open");
    setTimeout(() => {
      dlg.close();
      dlg._closing = false;
      if (restore && dlg._returnTo?.isConnected) dlg._returnTo.focus();
      dlg.dispatchEvent(new Event("modal-closed"));
    }, SH.motion.ms("--dur-base"));
  }

  function wire(dlg) {
    dlg.addEventListener("cancel", (e) => {
      e.preventDefault();
      close(dlg);
    });
    dlg.addEventListener("keydown", (e) => trapTab(dlg, e));
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg || e.target.closest("[data-close-modal]")) close(dlg);
    });
  }

  SH.modal = { open, close, wire, FOCUSABLE };
})();
