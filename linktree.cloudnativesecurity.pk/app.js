// CNSPK linktree — keep the copyright year current without a build step.
(function () {
    var el = document.getElementById('year');
    if (el) el.textContent = new Date().getFullYear();
})();
