export const TIMEZONE = "Africa/Kigali";
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timezone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timezone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
});

const dayFormatter = new Intl.DateTimeFormat("en-GB", {
    timezone: TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
});

export function dateKey(time) {
    const parts = dateFormatter.formatToParts(time);
    const part = (type) => parts.find((value) => value.type === type).value;
    return `${part("year")}-${part("month")}-${part("day")}`;
}

export const timeLabel = (time) => timeFormatter.format(time);
export const dayLabel = (time) => dayFormatter.format(time);
export const hourOf = (time) => Number(timeLabel(time).slice(0, 2));
export const rangeLabel = (row) =>
    `${timeLabel(row.start)}-${timeLabel(row.end)}`;

const codes = {
  0: ["Clear sky", "sun"],
  1: ["Mainly clear", "sun"],
  2: ["Partly cloudy", "cloud-sun"],
  3: ["Overcast", "cloud"],
  45: ["Fog", "fog"],
  48: ["Freezing fog", "fog"],
  51: ["Light drizzle", "rain"],
  53: ["Drizzle", "rain"],
  55: ["Heavy drizzle", "rain"],
  56: ["Freezing drizzle", "rain"],
  57: ["Heavy freezing drizzle", "rain"],
  61: ["Light rain", "rain"],
  63: ["Rain", "rain"],
  65: ["Heavy rain", "rain"],
  66: ["Freezing rain", "rain"],
  67: ["Heavy freezing rain", "rain"],
  71: ["Light snow", "snow"],
  73: ["Snow", "snow"],
  75: ["Heavy snow", "snow"],
  77: ["Snow grains", "snow"],
  80: ["Light showers", "rain"],
  81: ["Rain showers", "rain"],
  82: ["Heavy showers", "rain"],
  85: ["Snow showers", "snow"],
  86: ["Heavy snow showers", "snow"],
  95: ["Thunderstorm", "storm"],
  96: ["Thunderstorm with hail", "storm"],
  99: ["Severe thunderstorm with hail", "storm"],
};

export const knownCode = (value) => 
    Number.isInteger(value) && Object.hasOwn(codes, value);
export const condition = (code) => 
    knownCode(code)
        ? { label: codes[code][0], icon: codes[code][1] }
        : { label: "Conditions unavailable", icon: "unknown" };

export function planningHours(rows, date, now = Date.now()) {
    return rows.filter(
        (row) =>
            row.start >= now &&
        dateKey(row.start) === date &&
        hourOf(row.start) >= 6 &&
        hourOf(row.start) < 18,
    );
}

// These are transparent comfort preferences, not a weather safety assessment

export function recommend(
    rows,
    { date, duration = 2, rainLimit = 40, now = Date.now() },
) {
    if (
        ![1, 2, 3].includes(duration) ||
        !Number.isFinite(rainLimit) ||
        rainLimit < 0 ||
        rainLimit > 100
    )
        return [];
    
    const hours = planningHours(rows, date, now);
    const candidates = [];
    for (let index = 0; index <= hours.length - duration; index++) {
        const slice = hours.slice(index, index + duration);
        const qualifies = slice.every(
            (row, offset) =>
                row.start === slice[0].start + offset * 3600000 &&
                row.end - row.start === 3600000 &&
                Number.isFinite(row.rain) &&
                row.rain >= 0 &&
                row.rain <= rainLimit &&
                Number.isFinite(row.wind) &&
                row.wind >= 0 &&
                row.wind <= 25 &&
                Number.isFinite(row.temperature) &&
                row.temperature >= 12 &&
                row.temperature <= 32 &&
                knownCode(row.code) &&
                row.code < 95,
        );
        if (!qualifies) continue;
        candidates.push({
            start: slice[0].start,
            end: slice.at(-1).end,
            peakRain: Math.max(...slice.map((row) => row.rain)),
            meanRain: slice.reduce((sum, row) => sum + row.rain, 0) / duration,
            peakWind: Math.max(...slice.map((row) => row.wind)),
        });
    }
    candidates.sort(
        (a, b) =>
            a.peakRain - b.peakRain ||
            a.meanRain - b.meanRain ||
            a.peakWind - b.peakWind ||
            a.start - b.start,
    );
    const selected = [];
    for (const candidate of candidates) {
        if (
            selected.every(
                (other) => candidate.end <= other.start || candidate.start >= other.end,
            )
        )
            selected.push(candidate);
        if (selected.length === 3) break;
    }
    return selected;
}

export function nextWindow(forecast, now = Date.now()) {
    for (const day of forecast.daily) {
        const window = recommend(forecast.rows, { date: day.date, now})[0];
        if (window) return { ...window, date: day.date };
    }
    return null;
}