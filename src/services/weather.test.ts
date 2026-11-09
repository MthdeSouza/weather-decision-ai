import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { evaluateConstructionScenarios } from "../lib/climate-scenarios";
import { getHistoricalClimateContext } from "../lib/open-meteo";
import { createProcessingDiagnostics } from "../lib/ticket-processing";

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

  it("builds a historical climate context from Open-Meteo geocoding and archive responses", async () => {
    global.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("geocoding-api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                name: "São Paulo",
                admin1: "São Paulo",
                country: "Brazil",
                latitude: -23.55,
                longitude: -46.63,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("archive-api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            daily: {
              time: ["2023-01-01", "2023-01-02", "2023-01-03"],
              precipitation_sum: [1.2, 10.5, 0.4],
              temperature_2m_mean: [24.5, 27.0, 26.1],
              temperature_2m_max: [30, 34, 31],
              relative_humidity_2m_mean: [65, 70, 68],
              wind_speed_10m_max: [22, 18, 29],
              wind_gusts_10m_max: [38, 45, 52],
              weather_code: [0, 80, 95],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const context = await getHistoricalClimateContext({
      city: "São Paulo",
      state: "São Paulo",
      startDate: "2024-01-10",
    });

    assert.equal(context.location.name, "São Paulo");
    assert.equal(context.location.state, "São Paulo");
    assert.ok(context.summary.averageTemperatureC > 0);
    assert.ok(context.summary.rainyDays >= 1);
    assert.ok(context.source.includes("Open-Meteo"));
  });

  it("evaluates the 12 possible start months and compares scenario risk deterministically", async () => {
    const climateContext = {
      location: {
        name: "São Paulo",
        state: "São Paulo",
        country: "Brazil",
        latitude: -23.55,
        longitude: -46.63,
      },
      source: "Open-Meteo Historical Weather API (ERA5-Land)",
      period: {
        startDate: "2023-01-01",
        endDate: "2025-12-31",
        daysAnalyzed: 365,
      },
      summary: {
        precipitationAverageMm: 120,
        rainyDays: 80,
        averageTemperatureC: 22,
        intenseHeatDays: 10,
        averageHumidityPercent: 72,
        maxWindKmh: 50,
        strongGustDays: 5,
        adverseWeatherDays: 12,
      },
      notes: "Histórico climático de teste.",
    };

    const result = evaluateConstructionScenarios({
      climateContext,
      plannedStartDate: "2025-02-10",
      estimatedMonths: 6,
      stages: [
        { name: "Fundação", durationMonths: 2, climateSensitivity: 1.2 },
        { name: "Estrutura", durationMonths: 2, climateSensitivity: 1.5 },
        { name: "Acabamento", durationMonths: 2, climateSensitivity: 0.8 },
      ],
    });

    assert.ok(result.scenarios.length === 12);
    assert.ok(result.scenarios.every((scenario) => scenario.score >= 0));
    assert.ok(result.bestStartMonth);
    assert.ok(result.worstStartMonth);
    assert.ok(result.recommendation.length > 0);
  });

  it("sanitizes processing diagnostics to avoid leaking secrets or personal data", () => {
    const diagnostic = createProcessingDiagnostics(
      new Error("Gemini failed: AIzaKey123 and user@example.com"),
      "gemini",
    );

    assert.equal(diagnostic.errorType, "gemini_api_error");
    assert.ok(!diagnostic.message.includes("AIzaKey123"));
    assert.ok(!diagnostic.message.includes("user@example.com"));
    assert.ok(diagnostic.message.includes("[redacted]"));
  });
});
