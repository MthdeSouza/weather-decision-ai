import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { analyzeDecision } from "./gemini";
import { getWeatherSummary } from "./weather";

describe("getWeatherSummary", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("uses the weather API response and returns a structured summary", async () => {
    global.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("geocoding-api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            results: [
              { name: "Lisboa", latitude: 38.7223, longitude: -9.1393 },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            current: {
              temperature_2m: 18.4,
              relative_humidity_2m: 72,
              wind_speed_10m: 21,
              weather_code: 1,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await getWeatherSummary("Lisboa");

    assert.equal(result.city, "Lisboa");
    assert.equal(result.temperature, 18.4);
    assert.equal(result.humidity, 72);
    assert.equal(result.wind, 21);
    assert.ok(result.condition.length > 0);
  });

  it("answers a question about a city using the city name in the message", async () => {
    global.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("geocoding-api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            results: [
              { name: "Lisboa", latitude: 38.7223, longitude: -9.1393 },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            current: {
              temperature_2m: 18.4,
              relative_humidity_2m: 72,
              wind_speed_10m: 21,
              weather_code: 1,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await analyzeDecision("Qual é o clima em Lisboa hoje?");

    assert.ok(result);
    assert.ok(result.summary);
    assert.match(result.summary, /Lisboa/i);
    assert.ok(result.recommendation.length > 0);
  });
});
