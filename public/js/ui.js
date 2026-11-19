import { DEFAULT_LOCATION, validLocation } from "./api.js";
import { condition, dateKey, dayLabel, rangeLabel, timeLabel } from "./weather.js";

const shapes = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h6a2.5 2.5 0 1 1-2.5 2.5"/>',
  drop: '<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11Z"/>',
  arrow: '<path d="M6 18 18 6M6 6h12v12"/>',
  back: '<path d="m10 6-6 6 6 6M4 12h16"/>',
  spark:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  refresh:
    '<path d="M20 7v5h-5M4 17v-5h5M5 8a7.5 7.5 0 0 1 13-3l2 3M4 16l2 3a7.5 7.5 0 0 0 13-3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
  moon: '<path d="M20 14A8.5 8.5 0 0 1 10 4a8.5 8.5 0 1 0 10 10Z"/>',
  cloud: '<path d="M6 18h12a4 4 0 0 0 0-8 6 6 0 0 0-11-2A5 5 0 0 0 6 18Z"/>',
  "cloud-sun":
    '<circle cx="16" cy="7" r="4"/><path d="M16 1v1M22 7h1M21 2l-1 1M6 20h12a4 4 0 0 0 0-8 6 6 0 0 0-11-2A5 5 0 0 0 6 20Z"/>',
  rain: '<path d="M5 15h14a4 4 0 0 0-1-8A6 6 0 0 0 7 7a4 4 0 0 0-2 8ZM8 18l-1 3M13 18l-1 3M18 18l-1 3"/>',
  storm:
    '<path d="M5 14a4 4 0 0 1 2-7 6 6 0 0 1 11 0 4 4 0 0 1 1 8M12 12l-4 6h5l-2 5 7-9h-6l2-2"/>',
  fog: '<path d="M5 12a4 4 0 0 1 2-5 6 6 0 0 1 11 0 4 4 0 0 1 2 5M3 16h18M5 20h14"/>',
  snow: '<path d="M5 14a4 4 0 0 1 2-7 6 6 0 0 1 11 0 4 4 0 0 1 1 8M8 18v4M6 20h4M17 18v4M15 20h4"/>',
  unknown:
    '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01"/>',
};

export function icon(name) {
    const template = document.createElement("template");
    template.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] ?? shapes.unknown}</svg>`;
    return template.content.firstElementChild;
}

export function initializeIcons() {
    document
        .querySelectorAll("[data-icon]")
        .forEach((node) => node.replaceChildren(icon(node.dataset.icon)));
}

export const number = (value, digits = 0) =>
    Number.isFinite(value)
        ? new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits }).format(
            value,
        )
        : "-";

export function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export function setText(selector, text) {
    document
        .querySelectorAll(selector)
        .forEach((node) => (node.textContent = text));
}

export function locationFromUrl() {
    const parameters = new URLSearchParams(location.search);
    if (
        !parameters.has("lat") ||
        !parameters.has("lon") ||
        !parameters.get("lat")?.trim() ||
        !parameters.get("lon")?.trim()
    )
        return { ...DEFAULT_LOCATION };
    const place = {
        name: parameters.get("name") ?? "",
        latitude: Number(parameters.get("lat")),
        longitude: Number(parameters.get("lon")),
        country_code: "RW",
    };
    return validLocation(place) ? place : { ...DEFAULT_LOCATION };
}

export function pageHref(page, place, preferences = {}) {
    const params = new URLSearchParams({
        name: place.name,
        lat: place.latitude,
        lon: place.longitude,
    });
    for (const [key, value] of Object.entries(preferences))
        if (value !== null && value !== undefined) params.set(key, String(value));
    return `${page}?${params}`;
}

export function updateNavigation(place, preferences = {}) {
    document
        .querySelectorAll("[data-page]")
        .forEach(
            (link) =>
            (link.href = pageHref(
                link.dataset.page,
                place,
                link.dataset.page === "planner.html" ? preferences : {},
            )),
        );
}

export function updateUrl(place, preferences = {}) {
    history.replaceState(
        null,
        "",
        pageHref(
            location.pathname.split("/").at(-1) || "index.html",
            place,
            preferences,
        ),
    );
}

export function forecastDayLabel(day, now = Date.now()) {
    return day.date === dateKey(now) ? "Today" : dayLabel(day.time);
}

export function renderDays(container, days, place) {
    container.replaceChildren();
    for (const day of days) {
        const link = element("a", "wc-week-row");
        link.href = pageHref("planner.html", place, { date: day.date });
        const label = element("div", "", forecastDayLabel(day));
        label.append(element("small", "", condition(day.code).label));
        const values = element("span", "", `${number(day.max)}°`);
        values.append(element("span", "wc-low", `/ ${number(day.min)}°`));
        link.append(label, icon(condition(day.code).icon), values);
        container.append(link);
    }
}

export function renderHours(container, rows, best = null) {
    container.replaceChildren();
    if (!rows.length) {
        container.append(
            element(
                "p",
                "wc-empty",
                "No upcoming hours in this view. Choose another day.",
            ),
        );
        return;
    }
    for (const row of rows) {
        const cell = element("div", "wc-hour");
        const inWindow = best && row.start >= best.start && row.end <= best.end;
        if (inWindow) cell.classList.add("wc-hour-suggested");
        const label = element("span", "wc-hour-timee", timeLabel(row.start));
        label.append(element("span", "sr-only", ` to ${timeLabel(row.end)}`));
        const weather = condition(row.code);
        cell.append(
            label,
            icon(row.isDay === 0 && weather.icon === "sun" ? "moon" : weather.icon),
            element("span", "wc-hour-temp", `${number(row.temperature)}°`),
            element("span", "wc-hour-rain", `${number(row.rain)}% rain`),
        );
        cell.setAttribute(
            "aria-label",
            `${dayLabel(row.start)}, ${rangeLabel(row)}: ${number(row.temperature)} degrees celsius, precipitation chance ${number(row.rain)} percent, ${weather.label}${inWindow ? ", suggested window": ""}.`,
        );
        container.append(cell);
    }
}

export function renderArtwork(host, code, isDay) {
    const weather = condition(code);
    host.dataset.weather = weather.icon;
    host.dataset.night = isDay === 0 ? "true" : "false";
    host.setAttribute("aria-label", weather.label);
}

export function renderRecommendations(container, windows, duration) {
    container.replaceChildren();
    if (!windows.length) {
        container.append(
            element(
                "p",
                "wc-empty",
                "No window matches these preferences. Try a shorter duration, another day or a higher rain limit.",
            ),
        );
        return;
    }
    windows.forEach((window, index) => {
        const article = element("article", "wc-recommendation");
        const label = element("div", "wc-math-label");
        if (index === 0) label.append(icon("spark"));
        label.append(
            document.createTextNode(index === 0 ? "Best match" : "Another option"),
        );
        article.append(
            label,
            element("h3", "", rangeLabel(window)),
            element("p","", `Rain chance up to ${number(window.peakRain)}%`),
            element(
                "small",
                "",
                `Wind up to ${number(window.peakWind, 1)} Km/h · ${duration} ${duration === 1 ? "hour" : "hours"} outdoors`,
            ),
        );
        container.append(article);
    });
}

export function fetchedLabel(result) {
    return `${result.cached ? "Cached forecast": "Forecast retrieved"} at ${timeLabel(result.fetchedAt)} CAT. Auto-refresh every 10 minutes.`;
}

