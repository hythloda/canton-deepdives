(function () {
  const data = window.DEEPDIVES_DATA || { sessions: [] };
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const grid = document.getElementById("deepdives-grid");
  const empty = document.getElementById("empty-state");
  const search = document.getElementById("search");
  const tabs = document.querySelectorAll("[data-view]");
  const views = {
    cards: document.getElementById("cards-view"),
    calendar: document.getElementById("calendar-view")
  };

  document.getElementById("session-count").textContent = String(sessions.length);
  document.getElementById("speaker-count").textContent = String(new Set(sessions.map((session) => session.speaker).filter(Boolean)).size);

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });

  search.addEventListener("input", render);
  render();

  function setView(view) {
    tabs.forEach((tab) => {
      const isActive = tab.dataset.view === view;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });

    Object.entries(views).forEach(([key, element]) => {
      element.classList.toggle("active", key === view);
    });
  }

  function render() {
    const term = search.value.trim().toLowerCase();
    const filtered = sessions.filter((session) => searchableText(session).includes(term));

    grid.innerHTML = filtered.map((session) => (
      '<article class="card">' +
        '<div class="meta">' +
          pill(session.time || "Time TBD") +
          pill(session.company || "Company TBD") +
        '</div>' +
        '<div>' +
          '<h2>' + escapeHtml(session.title) + '</h2>' +
          '<p class="speaker">' + escapeHtml(session.speaker || "Speaker TBD") + '</p>' +
          '<p class="company">' + escapeHtml([session.role, session.company].filter(Boolean).join(", ")) + '</p>' +
        '</div>' +
      '</article>'
    )).join("");

    empty.hidden = filtered.length > 0;
  }

  function pill(value) {
    return '<span class="pill">' + escapeHtml(value) + '</span>';
  }

  function searchableText(session) {
    return Object.values(session).join(" ").toLowerCase();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
