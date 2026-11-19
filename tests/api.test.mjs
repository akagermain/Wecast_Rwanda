import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LOCATION,
  forecastUrl,
  searchUrl,
  parseForecast,
  parseLocations,
  requestJson,
} from "../public/js/api.js";
import { forecastFixture } from "./fixtures.mjs";

test("forecast requests specify units, Rwanda time and required fields without a key", () => {
  const p = forecastUrl(DEFAULT_LOCATION).searchParams;
  assert.equal(p.get("timezone"), "Africa/Kigali");
  assert.equal(p.get("timeformat"), "unixtime");
  assert.equal(p.get("forecast_days"), "3");
  assert.ok(p.get("hourly").includes("precipitation_probability"));
  assert.ok(p.get("current").includes("temperature_2m"));
  assert.equal(p.has("apikey"), false);
});
test("search is encoded safely and restricted to Rwanda", () => {
  const url = searchUrl("Kigali & Musanze");
  assert.equal(url.searchParams.get("countryCode"), "RW");
  assert.equal(url.searchParams.get("name"), "Kigali & Musanze");
  assert.throws(() => searchUrl("a"));
  assert.throws(() => searchUrl(" "));
});
test("invalid coordinates fail before making a request", () => {
  assert.throws(() => forecastUrl({ ...DEFAULT_LOCATION, latitude: 999 }));
});
test("normalization aligns precipitation with the preceding hour", () => {
  const raw = forecastFixture(),
    parsed = parseForecast(raw);
  assert.equal(parsed.rows[0].start, (raw.hourly.time[0] - 3600) * 1000);
  assert.equal(parsed.rows[0].end, raw.hourly.time[0] * 1000);
  assert.equal(parsed.daily.length, 3);
  assert.equal(parsed.current.temperature, 24);
});
test("null or impossible measurements remain missing", () => {
  const raw = forecastFixture();
  raw.hourly.precipitation_probability[0] = null;
  raw.hourly.wind_speed_10m[1] = -2;
  raw.hourly.weather_code[2] = 94;
  const { rows } = parseForecast(raw);
  assert.equal(rows[0].rain, null);
  assert.equal(rows[1].wind, null);
  assert.equal(rows[2].code, null);
});
test("incomplete arrays, unexpected units and broken hourly order are rejected", () => {
  const wrongArray = forecastFixture();
  wrongArray.hourly.temperature_2m.pop();
  assert.throws(() => parseForecast(wrongArray));
  const wrongUnits = forecastFixture();
  wrongUnits.hourly_units.wind_speed_10m = "mph";
  assert.throws(() => parseForecast(wrongUnits));
  const gap = forecastFixture();
  gap.hourly.time[3] += 3600;
  assert.throws(() => parseForecast(gap));
});
test("missing current conditions do not discard a usable hourly forecast", () => {
  const raw = forecastFixture();
  delete raw.current;
  assert.equal(parseForecast(raw).current, null);
});
test("empty location responses work and invalid results are discarded", () => {
  assert.deepEqual(parseLocations({}), []);
  assert.deepEqual(
    parseLocations({
      results: [
        { ...DEFAULT_LOCATION, country_code: "KE" },
        { ...DEFAULT_LOCATION, latitude: null },
      ],
    }),
    [],
  );
  assert.throws(() => parseLocations({ results: "wrong" }));
});
test("HTTP 429 and server failures have readable errors", async () => {
  for (const status of [429, 503])
    await assert.rejects(
      requestJson(`https://example.test/${status}`, {
        fetcher: async () => ({ ok: false, status }),
      }),
      status === 429 ? /busy/ : /HTTP 503/,
    );
});
test("network errors, unreadable JSON and API errors have readable feedback", async () => {
  await assert.rejects(
    requestJson("https://example.test/network", {
      fetcher: async () => {
        throw new TypeError("network");
      },
    }),
    /internet connection/,
  );
  await assert.rejects(
    requestJson("https://example.test/json", {
      fetcher: async () => ({
        ok: true,
        json: async () => {
          throw new Error("bad");
        },
      }),
    }),
    /unreadable/,
  );
  await assert.rejects(
    requestJson("https://example.test/error", {
      fetcher: async () => ({ ok: true, json: async () => ({ error: true }) }),
    }),
    /invalid response/,
  );
});
test("timeouts release the request and produce a retry message", async () => {
  const fetcher = async (url, { signal }) =>
    new Promise((resolve, reject) =>
      signal.addEventListener("abort", () => reject(new Error("aborted")), {
        once: true,
      }),
    );
  await assert.rejects(
    requestJson("https://example.test/timeout", { fetcher, timeoutMs: 5 }),
    /too long/,
  );
});
test("repeat requests use cache; refresh bypasses it", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return { ok: true, json: async () => ({ answer: calls }) };
  };
  const url = "https://example.test/cache";
  await requestJson(url, { fetcher });
  const cached = await requestJson(url, { fetcher });
  assert.equal(calls, 1);
  assert.equal(cached.cached, true);
  const refreshed = await requestJson(url, { fetcher, refresh: true });
  assert.equal(calls, 2);
  assert.equal(refreshed.data.answer, 2);
});
test("invalid API schemas are not cached", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return { ok: true, json: async () => ({}) };
  };
  for (let i = 0; i < 2; i++)
    await assert.rejects(
      requestJson("https://example.test/schema", {
        fetcher,
        parse: parseForecast,
      }),
    );
  assert.equal(calls, 2);
});
