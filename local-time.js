(function (global) {
  const sourceTimeZone = "America/New_York";

  function parseDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }

  function parseSlot(value) {
    const match = String(value || "").match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*ET$/i);
    if (!match) return null;

    let hour = Number(match[1]) % 12;
    if (match[3].toLowerCase() === "pm") hour += 12;
    return { hour, minute: Number(match[2] || 0) };
  }

  function zonedParts(date, timeZone) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const values = Object.fromEntries(
      formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
    );

    return {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day),
      hour: Number(values.hour),
      minute: Number(values.minute),
      second: Number(values.second),
    };
  }

  function toInstant(dateValue, slotValue) {
    const date = parseDate(dateValue);
    const slot = parseSlot(slotValue);
    if (!date || !slot) return null;

    const desired = Date.UTC(date.year, date.month - 1, date.day, slot.hour, slot.minute, 0);
    let timestamp = desired;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const actual = zonedParts(new Date(timestamp), sourceTimeZone);
      const actualAsUtc = Date.UTC(
        actual.year,
        actual.month - 1,
        actual.day,
        actual.hour,
        actual.minute,
        actual.second,
      );
      const adjustment = desired - actualAsUtc;
      timestamp += adjustment;
      if (adjustment === 0) break;
    }

    return new Date(timestamp);
  }

  function format(dateValue, slotValue, options) {
    const instant = toInstant(dateValue, slotValue);
    if (!instant) return "";
    return new Intl.DateTimeFormat(undefined, options).format(instant);
  }

  function formatDateTime(dateValue, slotValue) {
    return format(dateValue, slotValue, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }

  function formatTime(dateValue, slotValue) {
    return format(dateValue, slotValue, {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }

  function nextTuesdayDate(now) {
    const today = zonedParts(now || new Date(), sourceTimeZone);
    const calendarDate = new Date(Date.UTC(today.year, today.month - 1, today.day));
    const daysUntilTuesday = (2 - calendarDate.getUTCDay() + 7) % 7;
    calendarDate.setUTCDate(calendarDate.getUTCDate() + daysUntilTuesday);
    return calendarDate.toISOString().slice(0, 10);
  }

  function valueForFormat(dateValue, slotValue, kind) {
    if (kind === "time") return formatTime(dateValue, slotValue);
    if (kind === "month") return format(dateValue, slotValue, { month: "short" }).toUpperCase();
    if (kind === "day") return format(dateValue, slotValue, { day: "2-digit" });
    if (kind === "weekday") return format(dateValue, slotValue, { weekday: "long" });
    return formatDateTime(dateValue, slotValue);
  }

  function localize(root) {
    const scope = root || document;

    scope.querySelectorAll("[data-local-date][data-local-slot]").forEach((element) => {
      const dateValue = element.dataset.localDate;
      const slotValue = element.dataset.localSlot;
      const instant = toInstant(dateValue, slotValue);
      const value = valueForFormat(dateValue, slotValue, element.dataset.localFormat);
      if (!instant || !value) return;

      element.textContent = value;
      if (element.tagName === "TIME") element.dateTime = instant.toISOString();
      element.title = `Scheduled for ${dateValue} at ${slotValue} (${sourceTimeZone})`;
    });

    scope.querySelectorAll("[data-local-recurring-slot]").forEach((element) => {
      const slotValue = element.dataset.localRecurringSlot;
      const dateValue = nextTuesdayDate();
      const value = formatTime(dateValue, slotValue);
      if (!value) return;

      element.textContent = value;
      element.title = `Weekly ${slotValue} (${sourceTimeZone})`;
    });

    scope.querySelectorAll("[data-local-aria-date][data-local-aria-slot]").forEach((element) => {
      const value = formatDateTime(element.dataset.localAriaDate, element.dataset.localAriaSlot);
      if (value) element.setAttribute("aria-label", value);
    });
  }

  global.DeepDiveTime = {
    formatDateTime,
    formatTime,
    localize,
    nextTuesdayDate,
    toInstant,
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => localize(document));
    } else {
      localize(document);
    }
  }
})(window);
