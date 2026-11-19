import { TIMEZONE, dateKey, knownCode } from './weather.js';

export const CACHE_MS = 10 * 60 * 1000;
export const DEFAULT_LOCATION = { name: 'Kigali', latitude: -1.94995, longitude: 30.05885, country_code: 'RW', admin1: 'Kigali' };
const cache = new Map();
const hourlyFields = ['temperature_2m', 'precipitation_probability', 'wind_speed_10m', 'weather_code', 'is_day'];
const dailyFields = ['temperature_2m_max', 'temperature_2m_min', 'weather_code'];
const currentFields = ['temperature_2m', 'wind_speed_10m', 'weather_code', 'is_day'];
export class ApiError extends Error { }
const bounded = (value, min, max) => Number.isFinite(value) && value >= min && value <= max ? value : null;
const weatherCode = value => knownCode(value) ? value : null;
const daylight = value => value === 0 || value === 1 ? value : null;


export function validLocation(place) {
    return place && typeof place.name === 'string' && place.name.trim().length >= 2 && place.name.length <= 80 &&
        Number.isFinite(place.latitude) && Math.abs(place.latitude) <= 90 &&
        Number.isFinite(place.longitude) && Math.abs(place.longitude) <= 180;
}

export function forecastUrl(place) {
    if (!validLocation(place)) throw new ApiError('This location has invalid coordinates. Choose another place.');
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
        latitude: place.latitude, longitude: place.longitude,
        hourly: hourlyFields.join(','), daily: dailyFields.join(','),
        current: currentFields.join(','),
        forecast_days: 3, timezone: TIMEZONE, timeformat: 'unixtime',
        temperature_unit: 'celsius', wind_speed_unit: 'kmh'
    });
    return url;
}

export function searchUrl(query) {
    if (typeof query !== 'string' || query.trim().length < 2 || query.trim().length > 80) throw new ApiError('Enter a place between 2 and 80 characters.');
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.search = new URLSearchParams({ name: query.trim(), count: 8, language: 'en', format: 'json', countryCode: 'RW'});
    return url;
}

export function parseLocations(data) {
    if (!data || typeof data !== 'object' || data.error || (data.results !== undefined && !Array.isArray(data.results))) throw new ApiError('Location Search returned unexpected data. Try again.');
    return (data.results ?? []).filter(place => place.country_code === 'RW' && validLocation(place)).map(place => ({ name: place.name, latitude: place.latitude, longitude: place.longitude, country_code: 'RW', admin1: typeof place.admin1 === 'string' ? place.admin1: '' }));
}

export function parseForecast(data) {
    const hourly = data?.hourly, daily = data?.daily, units = data?.hourly_units;
    const validHourly = Array.isArray(hourly?.time) && hourly.time.length > 0 && hourlyFields.every(field => Array.isArray(hourly[field]) && hourly[field].length === hourly.time.length);
    const validDaily = Array.isArray(daily?.time) && daily.time.length > 0 && dailyFields.every(field => Array.isArray(daily[field]) && daily[field].length === daily.time.length);
    if (data?.timezone !== TIMEZONE || !validHourly || !validDaily || units?.wind_speed_10m !== 'km/h' || units?.precipitation_probability !== '%' || data.daily_units?.time !== 'unixtime' || data.daily_units?.temperature_2m_max !== '°C' || data.daily_units?.temperature_2m_min !== '°C') {
        throw new ApiError('The forecast is incomplete or has unexpected units. Refresh to try again.');
    }

    const rows = hourly.time.map((time, index) => {
        if (!Number.isFinite(time) || (index && time - hourly.time[index - 1] !== 3600)) throw new ApiError('The forecast has unexpected time intervals. Refresh to try again.');

        return {
            start: (time - 3600) * 1000, end: time * 1000,
            temperature: bounded(hourly.temperature_2m[index], -90, 60),
            rain: bounded(hourly.precipitation_probability[index], 0, 100),
            wind: bounded(hourly.wind_speed_10m[index], 0, 500),
            code: weatherCode(hourly.weather_code[index]),
            isDay: daylight(hourly.is_day[index])
        };
    });

    const days = daily.time.map((time, index) => {
        if (!Number.isFinite(time) || (index && time - daily.time[index - 1] !==86400)) throw new ApiError('The daily forecast has unexpected dates. Refresh to try again.');
        return {
            date: dateKey(time * 1000),
            time: time * 1000,
            max: bounded(daily.temperature_2m_max[index], -90, 60),
            min: bounded(daily.temperature_2m_min[index], -90, 60),
            code: weatherCode(daily.weather_code[index])
        };
    });

    const current = data.current;
    const currentValid = Number.isFinite(current?.time) && data.current_units?.time === 'unixtime' && data.current_units?.temperature_2m === '°C' && data.current_units?.wind_speed_10m === 'km/h';
    return {
        rows, daily: days,
        current: currentValid ? { time: current.time * 1000, temperature: bounded(current.temperature_2m, -90, 60), wind: bounded(current.wind_speed_10m, 0, 500), code: weatherCode(current.weather_code), isDay: daylight(current.is_day) } :null
    };
}

export async function requestJson(url, { refresh = false, parse = value => value, fetcher = globalThis.fetch, timeoutMs = 1000 } = {}) {
    const key = String(url), previous = cache.get(key);
    if (!refresh && previous && Date.now() - previous.fetchedAt < CACHE_MS) return { ...previous, cached: true };
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetcher(url, { signal: controller.signal, credentials: 'omit', mode: "cors"});
        if (!response.ok) {
            if (response.status === 429) throw new ApiError('The weather service is busy. Wait a minute, then try again.');
            throw new ApiError(`The weather service could not complete this request (HTTP ${response.status}). Please try again.`);
        }
        let raw;
        try {
            raw = await response.json();
        } catch {
            throw new ApiError('The weather service returned unreadable data. Please try again.');
        }

        if (!raw || typeof raw !== 'object' || raw.error) throw new ApiError('The weather service returned an invalid response. Please try again.');
        const result = { data: parse(raw), fetchedAt: Date.now(), cached: false };
        if (cache.size >= 20) cache.delete(cache.keys().next().value);
        cache.set(key, result);
        return result;
    } catch (error) {
        console.error(error);
        if (error instanceof ApiError) throw error;
        if (controller.signal.aborted) throw new ApiError('The weather request took too long. Please try again.');
        throw new ApiError('Could not reach the weather service. Check your internet connection, then try again.');
    } finally { clearTimeout(timer); }
}

export const getForecast = (place, options = {}) => requestJson(forecastUrl(place), { ...options, parse: parseForecast});
export async function searchLocations(query, options = {}) {
  const result = await requestJson(searchUrl(query), {
    ...options,
    parse: parseLocations,
  });

  const name = query.trim().toLowerCase();
  if (name !== "rusizi" && name !== "rusizi district") return result;

  const district = {
    name: "Rusizi District",
    latitude: -2.5702,
    longitude: 29.0754,
    country_code: "RW",
    admin1: "Western Province",
  };

  const otherMatches = result.data.filter(
    (place) => !(place.name === district.name && place.admin1 === district.admin1),
  );

  return { ...result, data: [district, ...otherMatches] };
}

export async function quickLocation(name) {
    if (name === 'Kigali') return { ...DEFAULT_LOCATION }
    const names = name === 'Huye' ? ['Huye', 'Butare'] : [name];
    for (const candidate of names) {
        const { data } = await searchLocations(candidate);
        if (data.length) return data.find(place => place.name.toLowerCase() === candidate.toLowerCase()) ?? data[0];
    }
    throw new ApiError('This place was not found. Open the activity planner to search another name.');
}