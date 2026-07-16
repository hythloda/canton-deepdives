(function () {
  const data = window.DEEPDIVES_DATA || { sessions: [] };
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const zoom = data.zoom || { passcode: "626262", slots: {} };
  const list = document.getElementById("session-list");
  const empty = document.getElementById("empty-state");
  const search = document.getElementById("search");
  const tabs = document.querySelectorAll("[data-view]");
  let activeView = "coming";

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });

  search.addEventListener("input", render);
  render();

  function setView(view) {
    activeView = view;

    tabs.forEach((tab) => {
      const isActive = tab.dataset.view === view;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });

    render();
  }

  function render() {
    const term = search.value.trim().toLowerCase();
    const filtered = sessions
      .filter((session) => session.valid !== false)
      .filter((session) => searchableText(session).includes(term))
      .filter((session) => getTiming(session) === activeView)
      .sort(sortSessions);

    list.innerHTML = filtered.map(renderSession).join("");
    empty.hidden = filtered.length > 0;
  }

  function renderSession(session) {
    return (
      '<article class="session-card">' +
        '<div class="date-icon" aria-label="' + escapeAttr(dateLabel(session)) + '">' +
          '<span>' + escapeHtml(dateMonth(session)) + '</span>' +
          '<strong>' + escapeHtml(dateDay(session)) + '</strong>' +
        '</div>' +
        '<div class="session-main">' +
          '<div class="meta">' + renderMeta(session) + '</div>' +
          '<h2>' + escapeHtml(session.title) + '</h2>' +
          '<p class="speaker-line">' + escapeHtml(session.speaker || "Speaker TBD") + '</p>' +
          '<p class="company">' + escapeHtml([session.role, session.company].filter(Boolean).join(", ")) + '</p>' +
          renderLinks(session) +
        '</div>' +
      '</article>'
    );
  }

  function renderMeta(session) {
    return [
      session.group ? pill(session.group) : "",
      pill(weekdayLabel(session) + (session.time ? " / " + session.time : "")),
      pill(session.company || "Company TBD")
    ].join("");
  }

  function renderLinks(session) {
    const isPast = getTiming(session) === "past";
    const links = [];

    if (isPast) {
      if (session.presentationUrl) {
        links.push(linkButton(session.presentationUrl, "Presentation"));
      }

      if (session.recordingUrl) {
        links.push(linkButton(session.recordingUrl, "Recording"));
      }

      return '<div class="session-actions">' + links.join("") + '</div>';
    }

    const zoomLinks = getZoomLinks(session);

    for (const zoomLink of zoomLinks) {
      links.push(linkButton(zoomLink.url, zoomLink.label));
    }

    if (session.presentationUrl) {
      links.push(linkButton(session.presentationUrl, "Presentation"));
    }

    if (session.recordingUrl) {
      links.push(linkButton(session.recordingUrl, "Recording"));
    }

    links.push('<span class="passcode">Meeting passcode ' + escapeHtml(zoom.passcode) + '</span>');

    return '<div class="session-actions">' + links.join("") + '</div>';
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

  function weekdayLabel(session) {
    if (session.date) return formatDate(session.date, { weekday: "long" });
    return session.day || "Tuesday";
  }

  function getZoomLinks(session) {
    const slots = session.zoomSlots || inferZoomSlots(session);

    return slots
      .map((slot) => ({ label: "Zoom " + slot, url: zoom.slots && zoom.slots[slot] }))
      .filter((entry) => entry.url);
  }

  function inferZoomSlots(session) {
    if (session.zoomSlot) return [session.zoomSlot];
    if (/6am\s*\/\s*10am/i.test(session.time || "")) return ["6am ET", "10am ET"];
    if (/6am/i.test(session.time || "")) return ["6am ET"];
    return ["10am ET"];
  }

  function getTiming(session) {
    const group = String(session.group || "").trim().toLowerCase();
    if (group === "past") return "past";
    if (group) return "coming";
    if (!session.date) return "coming";
    const sessionDate = new Date(session.date + "T23:59:59");
    return sessionDate < new Date() ? "past" : "coming";
  }

  function sortSessions(left, right) {
    const leftTime = left.date ? new Date(left.date + "T12:00:00").getTime() : Number.MAX_SAFE_INTEGER;
    const rightTime = right.date ? new Date(right.date + "T12:00:00").getTime() : Number.MAX_SAFE_INTEGER;
    return activeView === "past" ? rightTime - leftTime : leftTime - rightTime;
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
