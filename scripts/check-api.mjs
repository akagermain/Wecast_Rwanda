import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { DEFAULT_LOCATION, forecastUrl, searchUrl, parseForecast, parseLocations } from "../public/js/api.js";

const report = {
    checkedAt: new Date().toISOString(),
    passed: false,
    checks: [],
};

async function check(name, url, status = 200) {
    const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { Origin: "http://127.0.0.1:4173" },
    });
    assert.equal(response.status, status, `${name}: expected HTTP ${status}`);
    const cors = response.headers.get("access-control-allow-origin");
    assert.ok(
        cors === "*" || cors === "http://127.0.0.1:4173",
        `${name}: expected browser CORS permission`,
    );
    const data = await response.json();
    const entry = {
        name,
        url: String(url),
        status: response.status,
        cors,
        passed: true,
    };
    report.checks.push(entry);
    return { data, entry };
}

try {
    const search = await check("Kigali location search", searchUrl("Kigali"));
    assert.ok(
        parseLocations(search.data).some((place) => place.name === "Kigali"),
    );
    const forecast = await check(
        "Three-day Kigali forecast",
        forecastUrl(DEFAULT_LOCATION),
    );
    const normalized = parseForecast(forecast.data);
    assert.equal(normalized.rows.length, 72);
    assert.equal(normalized.daily.length, 3);
    assert.ok(normalized.rows.some((row) => Number.isFinite(row.rain)));
    forecast.entry.hours = normalized.rows.length;
    forecast.entry.days = normalized.daily.length;
    const empty = await check(
        "Unknown Rwanda Location",
        searchUrl("zzzxqvwecastxxx"),
    );
    assert.equal(parseLocations(empty.data).length, 0);
    const invalid = await check(
        "Invalid coordinates",
        "https://api.open-meteo.com/v1/forecast?latitude=999&longitude=30", 400,
    );
    assert.equal(invalid.data.error, true);
    report.passed = true;
}   catch (error) {
    report.error = error.message;
    report.cause = error.cause?.code ?? null;
    process.exitCode = 1;
}

await mkdir(new URL("../docs/evidence/", import.meta.url), { recursive: true });
await writeFile(
    new URL("../docs/evidence/api-check.json", import.meta.url), JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));