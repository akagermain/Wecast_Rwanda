import { CACHE_MS, getForecast, searchLocations } from "./api.js";
import { condition, dateKey, dayLabel, planningHours, rangeLabel, recommend } from "./weather.js";
import { element, fetchedLabel, forecastDayLabel, icon, initializeIcons, locationFromUrl, number, renderHours, renderRecommendations, setText, updateNavigation, updateUrl } from "./ui.js";

initializeIcons();
const q = (selector) => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const state = {
    place: locationFromUrl(),
    result: null,
    sequence: 0,
    searchSequence: 0,
    loading: false,
};

const day = q("#planning-day"),
    duration = q("#duration"),
    limit = q("#rain-limit");
if (["1", "2", "3"].includes(params.get("duration")))
    duration.value = params.get("duration");
if (["10", "20", "40", "60"].includes(params.get("limit")))
    limit.value = params.get("limit");
q("#location-search").value = state.place.name;

function preferences() {
    return {
        date: day.value,
        duration: Number(duration.value),
        limit: Number(limit.value),
    };
}

function render() {
    if (!state.result) return;
    const now = Date.now(),
        forecast = state.result.data,
        prefs = preferences();
    const hours = planningHours(forecast.rows, prefs.date, now);
    const windows = recommend(forecast.rows, {
        date: prefs.date,
        duration: prefs.duration,
        rainLimit: prefs.limit,
        now,
    });

    const first = hours[0];
    setText("#selected-place", state.place.name);
    setText(
        "#selected-hour",
        first
            ? `${dayLabel(first.start)} · ${rangeLabel(first)} forecast`
            : "No upcoming planning hours. Choose another day.",
    );

    setText("[data-forecast-temp]", number(first?.temperature));
    setText("#forecast-rain", number(first?.rain));
    setText("#forecast-wind", number(first?.wind, 1));
    q("#forecast-icon").replaceChildren(icon(condition(first?.code).icon));
    setText(
        "#conditions-heading",
        first ? `${rangeLabel(first)} forecast conditions` : "Forecast conditions",
    );
    renderHours(q("#hourly-forecast"), hours, windows[0]);
    renderRecommendations(q("#recommendations"), windows, prefs.duration);
    setText(
        "#window-context",
        `${prefs.duration}-hour windows · rain chance up to ${prefs.limit}%`,
    );
    setText("#forecast-status", fetchedLabel(state.result));
    updateNavigation(state.place, prefs);
    updateUrl(state.place, prefs);
}

function populateDays(requestedDate) {
    const today = dateKey(Date.now());
    const days = state.result.data.daily.filter((value) => value.date >= today);
    day.replaceChildren();
    for (const value of days)
        day.add(new Option(forecastDayLabel(value), value.date));
    if (days.some((value) => value.date === requestedDate))
        day.value = requestedDate;
}

async function load(place = state.place, force = false) {
    const sequence = ++state.sequence;
    state.loading = true;
    const desired = day.value || params.get("date");
    state.result = null;
    q("#weather-content").hidden = true;
    q("#forecast-error").hidden = true;
    q("#refresh").disabled = true;
    q("#weather-content").setAttribute("aria-busy", "true");
    q("#forecast-status").textContent = `Loading the forecast for ${place.name}...`;

    // Keep the selected place available for a retry, including after an API failure.
    state.place = place;
    try {
        const result = await getForecast(place, { refresh: force });
        if (sequence !== state.sequence) return;
        state.result = result;
        populateDays(desired);
        render();
        q("#weather-content").hidden = false;
    } catch (problem) {
        if (sequence !== state.sequence) return;
        q("#forecast-error").textContent = problem.message;
        q("#forecast-error").hidden = false;
        q("#forecast-status").textContent = "Forecast unavailable. Use Refresh to try again.";
    } finally {
        if (sequence === state.sequence) {
            state.loading = false;
            q("#refresh").disabled = false;
            q("#weather-content").setAttribute("aria-busy", "false");
        }
    }
}

q("#search-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const sequence = ++state.searchSequence,
        query = q("#location-search").value.trim();
    q("#search-results").replaceChildren();
    q("#search-message").textContent = "Searching Rwanda...";
    q("#search-button").disabled = true;
    try {
        const { data: places } = await searchLocations(query);
        if (
            sequence !== state.searchSequence ||
            q("#location-search").value.trim() !== query
        )
            return;
            q("#search-message").textContent = places.length
                ? "Choose a location below."
                : "No matching place found in Rwanda. Try a nearby city or another spelling.";
            for (const place of places) {
                const button = element("button", "wc-search-result");
                button.type = "button";
                button.append(
                    element("span", "", place.name),
                    element(
                        "small",
                        "",
                        `${place.admin1 ? place.admin1 + ", ": ""}Rwanda`,
                    ),
                );
                button.addEventListener("click", () => {
                    q("#location-search").value = place.name;
                    q("#search-results").replaceChildren();
                    q("#search-message").textContent = `Selected ${place.name}.`;
                    load(place);
                });
                q("#search-results").append(button);
            }
    } catch (problem) {
        if (sequence === state.searchSequence)
            q("#search-message").textContent = problem.message;
    } finally {
        if (sequence === state.searchSequence) q("#search-button").disabled = false;
    }
});
q("#location-search").addEventListener("input", () => {
    ++state.searchSequence;
    q("#search-results").replaceChildren();
    q("#search-message").textContent = "Search locations within Rwanda.";
    q("#search-button").disabled = false;
});
for (const select of [day, duration, limit])
    select.addEventListener("change", render);
q("#refresh").addEventListener("click", () => load(state.place, true));
function tick() {
    if (document.hidden || state.loading) return;
    if (state.result && Date.now() - state.result.fetchedAt >= CACHE_MS)
        load(state.place, true);
    else render();
}

setInterval(tick, 60000);
document.addEventListener("Visibilitychange", tick);
updateNavigation(state.place);
load();