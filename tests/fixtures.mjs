export function forecastFixture() {
    const start = Date.parse("2030-01-10T00:00:00+02:00") / 1000;
    return {
        timezone: "Africa/Kigali",
        current_units: {
            time: "unixtime",
            temperature_2m: "°C",
            wind_speed_10m: "km/h",
        },
        current: {
            time: start,
            temperature_2m: 24,
            wind_speed_10m: 9,
            weather_code: 2,
            is_day: 1,
        },
        hourly_units: {
            time: "unixtime",
            temperature_2m: "°C",
            precipitation_probability: "%",
            wind_speed_10m: "km/h",
        },
        hourly: {
            time: Array.from({ length: 72 }, (_, i) => start + i * 3600),
            temperature_2m: Array(72).fill(24),
            precipitation_probability: Array(72).fill(20),
            wind_speed_10m: Array(72).fill(9),
            weather_code: Array(72).fill(2),
            is_day: Array(72).fill(1),
        },
        daily_units: {
            time: "unixtime",
            temperature_2m_max: "°C",
            temperature_2m_min: "°C",
        },
        daily: {
            time: [start, start + 86400, start + 172800],
            temperature_2m_max: [26, 24, 27],
            temperature_2m_min: [18, 17, 18],
            weather_code: [2, 61, 2],
        },
    };
}
export function planningRows(rain = [30, 20, 10, 15, 25, 30]) {
    const start = Date.parse("2030-01-10T08:00:00+02:00");
    return rain.map((value, index) => ({
        start: start + index * 3600000,
        end: start + (index + 1) * 3600000,
        rain: value,
        wind: 9,
        temperature: 24,
        code: 2,
        isDay: 1,
    }));
}
