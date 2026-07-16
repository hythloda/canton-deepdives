(function () {
  const data = window.DEEPDIVES_DATA || { sessions: [] };
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const zoom = data.zoom || { passcode: "626262", slots: {} };
  const grid = document.getElementById("deepdives-grid");
  const calendar = document.getElementById("calendar-list");
  const empty = document.getElementById("empty-state");
  const calendarEmpty = document.getElementById("calendar-empty-state");
  const search = document.getElementById("search");
  const tabs = document.querySelectorAll("[data-view]");
  const views = {
    cards: document.getElementById("cards-view"),
    calendar: document.getElementById("calendar-view")
  };

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
    const tuesdaySessions = filtered.filter((session) => (session.day || "Tuesday").toLowerCase() === "tuesday");

    grid.innerHTML = filtered.map(renderCard).join("");
    calendar.innerHTML = tuesdaySessions.map(renderCalendarRow).join("");
    empty.hidden = filtered.length > 0;
    calendarEmpty.hidden = tuesdaySessions.length > 0;
  }

  function renderCard(session) {
    return (
      '<article class="card">' +
        '<div class="card-date" aria-label="' + escapeAttr(dateLabel(session)) + '">' +
          '<span>' + escapeHtml(dateMonth(session)) + '</span>' +
          '<strong>' + escapeHtml(dateDay(session)) + '</strong>' +
        '</div>' +
        '<div class="card-body">' +
          '<div class="meta">' +
            pill(session.time || "Time TBD") +
            pill(session.company || "Company TBD") +
          '</div>' +
          '<h2>' + escapeHtml(session.title) + '</h2>' +
          '<p class="speaker">' + escapeHtml(session.speaker || "Speaker TBD") + '</p>' +
          '<p class="company">' + escapeHtml([session.role, session.company].filter(Boolean).join(", ")) + '</p>' +
          renderLinks(session) +
        '</div>' +
      '</article>'
    );
  }

  function renderCalendarRow(session) {
    return (
      '<article class="calendar-row">' +
        '<div class="card-date" aria-label="' + escapeAttr(dateLabel(session)) + '">' +
          '<span>' + escapeHtml(dateMonth(session)) + '</span>' +
          '<strong>' + escapeHtml(dateDay(session)) + '</strong>' +
        '</div>' +
        '<div class="calendar-main">' +
          '<div class="meta">' +
            pill("Tuesday") +
            pill(session.time || "Time TBD") +
            pill("Passcode " + zoom.passcode) +
          '</div>' +
          '<h2>' + escapeHtml(session.title) + '</h2>' +
          '<p>' + escapeHtml([session.speaker, session.role, session.company].filter(Boolean).join(", ")) + '</p>' +
          renderLinks(session) +
        '</div>' +
      '</article>'
    );
  }

  function renderLinks(session) {
    const zoomUrl = zoom.slots && zoom.slots[session.zoomSlot || session.time];
    const links = [];

    if (zoomUrl) {
      links.push(linkButton(zoomUrl, "Open Zoom"));
    }

    if (session.presentationUrl) {
      links.push(linkButton(session.presentationUrl, "Open presentation"));
    }

    if (session.recordingUrl) {
      links.push(linkButton(session.recordingUrl, "Open recording"));
    }

    links.push('<span class="passcode">Passcode ' + escapeHtml(zoom.passcode) + '</span>');

    return '<div class="card-actions">' + links.join("") + '</div>';
  }

  function linkButton(url, label) {
    return '<a class="action-link compact" href="' + escapeAttr(url) + '" target="_blank" rel="noopener">' + escapeHtml(label) + '</a>';
  }

  function pill(value) {
    return '<span class="pill">' + escapeHtml(value) + '</span>';
  }

  function dateLabel(session) {
    if (session.date) return formatDate(session.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    return "Tuesday date to be announced";
  }

  function dateMonth(session) {
    if (session.date) return formatDate(session.date, { month: "short" }).toUpperCase();
    return "Tue";
  }

  function dateDay(session) {
    if (session.date) return formatDate(session.date, { day: "2-digit" });
    return "TBD";
  }

  function formatDate(value, options) {
    const date = new Date(value + "T12:00:00");
    if (Number.isNaN(date.getTime())) return "TBD";
    return date.toLocaleDateString("en-US", options);
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

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
