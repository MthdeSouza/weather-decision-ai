"use client";

import { useEffect, useState } from "react";

import { CONSTRUCTION_TYPES, PROPERTY_TYPES } from "@/constants/tickets";
import { fetchBrazilStates, fetchCitiesByState } from "@/data/brazilLocations";
import { createTicket } from "@/services/tickets";
import type { TicketCreateInput } from "@/types/ticket";

const initialState: TicketCreateInput = {
  city: "",
  state: "",
  propertyType: "residential",
  constructionType: "masonry",
  estimatedMonths: 0,
  builtArea: 0,
};

export function TicketForm({ onCreated }: { onCreated?: () => void }) {
  const [form, setForm] = useState<TicketCreateInput>(initialState);
  const [errors, setErrors] = useState<
    Partial<Record<keyof TicketCreateInput, string>>
  >({});
  const [stateOptions, setStateOptions] = useState<
    Array<{ nome: string; sigla: string }>
  >([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [stateSearch, setStateSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [isStateOpen, setIsStateOpen] = useState(false);
  const [isCityOpen, setIsCityOpen] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function loadStates() {
      try {
        const states = await fetchBrazilStates();
        setStateOptions(states);

        if (!form.state && states.length > 0) {
          setForm((current) => ({
            ...current,
            state: states[0].sigla,
          }));
        }
      } catch {
        setStateOptions([]);
      }
    }

    void loadStates();
  }, [form.state]);

  useEffect(() => {
    if (!form.state) {
      setCityOptions([]);
      setForm((current) => ({ ...current, city: "" }));
      return;
    }

    async function loadCities() {
      setIsLoadingCities(true);

      try {
        const cities = await fetchCitiesByState(form.state);
        setCityOptions(cities);

        setForm((current) => ({
          ...current,
          city:
            current.city && cities.includes(current.city)
              ? current.city
              : (cities[0] ?? ""),
        }));
      } catch {
        setCityOptions([]);
        setForm((current) => ({ ...current, city: "" }));
      } finally {
        setIsLoadingCities(false);
      }
    }

    void loadCities();
  }, [form.state]);

  const validate = () => {
    const nextErrors: Partial<Record<keyof TicketCreateInput, string>> = {};

    if (!form.city.trim()) {
      nextErrors.city = "Informe a cidade.";
    }

    if (!form.state.trim()) {
      nextErrors.state = "Informe o estado.";
    }

    if (!form.propertyType) {
      nextErrors.propertyType = "Selecione o tipo de imóvel.";
    }

    if (!form.constructionType) {
      nextErrors.constructionType = "Selecione o tipo de construção.";
    }

    if (
      !Number.isInteger(form.estimatedMonths) ||
      Number(form.estimatedMonths) <= 0
    ) {
      nextErrors.estimatedMonths =
        "A estimativa deve ser em meses inteiros e positivos.";
    }

    if (
      !Number.isFinite(Number(form.builtArea)) ||
      Number(form.builtArea) <= 0
    ) {
      nextErrors.builtArea =
        "A área construída deve ser um número maior que zero.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (
    field: keyof TicketCreateInput,
    value: string | number,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    if (field === "state") {
      setCitySearch("");
      setIsCityOpen(false);
    }

    if (field === "city") {
      setCitySearch("");
    }

    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage("");

    try {
      await createTicket(form);
      setSuccessMessage("Chamado cadastrado com sucesso.");
      setForm(initialState);
      onCreated?.();
    } catch (error) {
      setSuccessMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível abrir o chamado.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
            Nova análise
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">
            Abrir chamado
          </h2>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="relative">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Estado
          </label>
          <button
            type="button"
            onClick={() => setIsStateOpen((current) => !current)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-900 outline-none transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <span>
              {stateOptions.find((option) => option.sigla === form.state)
                ?.nome ?? "Selecione o estado"}
            </span>
            <span>▾</span>
          </button>

          {isStateOpen ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-950">
              <input
                value={stateSearch}
                onChange={(event) => setStateSearch(event.target.value)}
                placeholder="Buscar estado"
                className="mb-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <div className="max-h-56 overflow-y-auto">
                {stateOptions
                  .filter(
                    (stateOption) =>
                      stateOption.nome
                        .toLowerCase()
                        .includes(stateSearch.toLowerCase()) ||
                      stateOption.sigla
                        .toLowerCase()
                        .includes(stateSearch.toLowerCase()),
                  )
                  .map((stateOption) => (
                    <button
                      key={stateOption.sigla}
                      type="button"
                      onClick={() => {
                        handleChange("state", stateOption.sigla);
                        setIsStateOpen(false);
                        setStateSearch("");
                      }}
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-sky-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {stateOption.nome} ({stateOption.sigla})
                    </button>
                  ))}
              </div>
            </div>
          ) : null}

          {errors.state ? (
            <p className="mt-1 text-xs text-rose-600">{errors.state}</p>
          ) : null}
        </div>

        <div className="relative">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Cidade
          </label>
          <button
            type="button"
            disabled={!form.state || isLoadingCities}
            onClick={() => setIsCityOpen((current) => !current)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-900 outline-none transition focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <span>
              {isLoadingCities
                ? "Carregando cidades..."
                : form.city || "Selecione a cidade"}
            </span>
            <span>▾</span>
          </button>

          {isCityOpen && form.state && cityOptions.length > 0 ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-950">
              <input
                value={citySearch}
                onChange={(event) => setCitySearch(event.target.value)}
                placeholder="Buscar cidade"
                className="mb-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <div className="max-h-56 overflow-y-auto">
                {cityOptions
                  .filter((availableCity) =>
                    availableCity
                      .toLowerCase()
                      .includes(citySearch.toLowerCase()),
                  )
                  .map((availableCity) => (
                    <button
                      key={availableCity}
                      type="button"
                      onClick={() => {
                        handleChange("city", availableCity);
                        setIsCityOpen(false);
                        setCitySearch("");
                      }}
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-sky-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {availableCity}
                    </button>
                  ))}
              </div>
            </div>
          ) : null}

          {errors.city ? (
            <p className="mt-1 text-xs text-rose-600">{errors.city}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Tipo de imóvel
          </label>
          <select
            value={form.propertyType}
            onChange={(event) =>
              handleChange("propertyType", event.target.value)
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {PROPERTY_TYPES.map((propertyType) => (
              <option key={propertyType.value} value={propertyType.value}>
                {propertyType.label}
              </option>
            ))}
          </select>
          {errors.propertyType ? (
            <p className="mt-1 text-xs text-rose-600">{errors.propertyType}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Tipo de construção
          </label>
          <select
            value={form.constructionType}
            onChange={(event) =>
              handleChange("constructionType", event.target.value)
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {CONSTRUCTION_TYPES.map((constructionType) => (
              <option
                key={constructionType.value}
                value={constructionType.value}
              >
                {constructionType.label}
              </option>
            ))}
          </select>
          {errors.constructionType ? (
            <p className="mt-1 text-xs text-rose-600">
              {errors.constructionType}
            </p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Estimativa de construção (meses)
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={form.estimatedMonths || ""}
            onChange={(event) =>
              handleChange("estimatedMonths", Number(event.target.value))
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            placeholder="12"
          />
          {errors.estimatedMonths ? (
            <p className="mt-1 text-xs text-rose-600">
              {errors.estimatedMonths}
            </p>
          ) : null}
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Área construída (m²)
          </label>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={form.builtArea || ""}
            onChange={(event) =>
              handleChange("builtArea", Number(event.target.value))
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            placeholder="250.5"
          />
          {errors.builtArea ? (
            <p className="mt-1 text-xs text-rose-600">{errors.builtArea}</p>
          ) : null}
        </div>
      </div>

      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
          {successMessage}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Enviando..." : "Abrir chamado"}
      </button>
    </form>
  );
}
