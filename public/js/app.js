import { CACHE_MS, DEFAULT_LOCATION, getForecast, quickLocation } from './api.js';
import { TIMEZONE, condition, dateKey, dayLabel, nextWindow, rangeLabel, timeLabel } from './weather.js';
import { initializeIcons, locationFromUrl, number, pageHref, renderArtwork, renderDays, renderHours, setText, fetchedLabel, updateNavigation, updateUrl } from './ui.js';


initializeIcons();
const picker = document.querySelector("#location-picker");
const content = document.querySelector("#weather-content");
const status = document.querySelector("#forecast-status");
const error = document.querySelector("#forecast-error");
const refresh = document.querySelector("#refresh");
const state = {
    place: locationFromUrl(),
    result: null,
    sequence: 0,
    loading: false,
};

function syncPicker() {
    picker.querySelector("[data-custom]")?.remove();
    if ([...picker.options].some((option) => option.value === state.place.name))
        picker.value = state.place.name;
    else {
        const option = new Option(`${state.place.name}, Rwanda`, "custom");
        option.dataset.custom = "true";
        picker.add(option);
        picker.value = "custom";
    }
}

function render() {
    if (!state.result) return;
    const forecast = state.result.data,
        now = Date.now(),
        current = forecast.current;
    const currentFresh = current && Math.abs(now - current.time) < 60 * 60 * 1000;
    setText(
        "[data-current-temp]",
        number(currentFresh ? current.temperature : null),
    );
    setText("[data-current-wind]", number(currentFresh ? current.wind: null, 1));
    const interval = forecast.rows.find(
        (row) => row.start <= now && row.end > now,
    );
    setText("[data-current-rain]", number(interval?.rain));
    const weather = condition(currentFresh ? current.code : null);
    setText("#condition", weather.label);
    setText(
        "#conditions-time",
        currentFresh
            ? `Current model estimate · ${timeLabel(current.time)} CAT`
            : "Current conditions are unavailable",
    );

    renderArtwork(
        document.querySelector("#weather-art"),
        currentFresh ? current.code : null,
        currentFresh ? current.isDay : null,
    );

    const today = dateKey(now);
    const nextHours = forecast.rows
        .filter((row) => row.end > now && dateKey(row.start) === today)
        .slice(0, 6);
    setText(
        "#hourly-heading",
        nextHours.length ? "Today, hour by hour" : "Tomorrow, hour by hour",
    );

    renderHours(
        document.querySelector("#hourly-forecast"),
        nextHours.length
            ? nextHours
            : forecast.rows
                .filter((row) => row.start >= now && dateKey(row.start) !== today)
                .slice(0, 6),
    );

    renderDays(
        document.querySelector("#daily-forecast"),
        forecast.daily,
        state.place,
    );
    const best = nextWindow(forecast, now);
    setText("#window-time", best ? rangeLabel(best) : "Explore another day");
    setText(
        "#window-detail",
        best
            ? `${best.date === today ? "Today": dayLabel(best.start)} · rain chance up to ${number(best.peakRain)}%`
            : "No 2-hour window matches our defualt preferences.",
    );
    document.querySelector("#open-planner").href = pageHref(
        "planner.html",
        state.place,
        best ? { date: best.date, duration: 2, limit: 40 } : {},
    );
    status.textContent = fetchedLabel(state.result);
    setText(
        "#today-date",
        new Intl.DateTimeFormat("en-GB", {
            timeZone: TIMEZONE,
            weekday: "long",
            day: "numeric",
            month: "long",
        }).format(now) + " · CAT",
    );
}

async function load(resolvePlace = async () => state.place, force = false) {
    const sequence = ++state.sequence;
    state.loading = true;
    state.result = null;
    content.hidden = true;
    error.hidden = true;
    refresh.disabled =  true;
    content.setAttribute("aria-busy", "true");
    status.textContent = "Loading the latest forecast…";

    try {
        const place = await resolvePlace();
        if (sequence !== state.sequence) return;
        const result = await getForecast(place, { refresh: force });
        if (sequence !== state.sequence) return;
        state.place = place;
        state.result = result;
        syncPicker();
        updateNavigation(place);
        updateUrl(place);
        render();
        content.hidden = false;
    } catch (problem) {
        if (sequence !== state.sequence) return;
        error.textContent = problem.message;
        error.hidden = false;
        status.textContent = "Forecast unavailable. Use Refresh to try again.";
    } finally {
        if (sequence === state.sequence) {
            state.loading = false;
            refresh.disabled = false;
            content.setAttribute("aria-busy", "false");
        }
    }
}

picker.addEventListener("change", () => {
    const selected = picker.value;
    load(() => (selected === "custom" ? state.place : quickLocation(selected)));
});
refresh.addEventListener("click", () => {
    const selected = picker.value;
    load(
        () => (selected === "custom" ? state.place : quickLocation(selected)),
        true,
    );
});

function tick() {
    if (document.hidden || state.loading) return;
    if (state.result && Date.now() - state.result.fetchedAt >= CACHE_MS)
        load(undefined, true);
    else render();
}

setInterval(tick, 60000);
document.addEventListener("visibilitychange", tick);
if (!state.place) state.place = { ...DEFAULT_LOCATION };
syncPicker();
load();