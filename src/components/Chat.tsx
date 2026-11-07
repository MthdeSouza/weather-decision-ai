"use client";

import { useEffect, useState } from "react";

import { Message } from "@/components/Message";
import { fetchBrazilStates, fetchCitiesByState } from "@/data/brazilLocations";
import type { Message as ChatMessage } from "@/types/chat";

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Olá! Me diga o que você quer decidir e eu te ajudo com uma recomendação com base no clima.",
  },
];

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [stateOptions, setStateOptions] = useState<
    Array<{ nome: string; sigla: string }>
  >([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [selectedState, setSelectedState] = useState("");
  const [city, setCity] = useState("");
  const [stateSearch, setStateSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [isStateOpen, setIsStateOpen] = useState(false);
  const [isCityOpen, setIsCityOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadStates() {
      try {
        const states = await fetchBrazilStates();
        setStateOptions(states);
        const firstState = states[0];
        if (firstState) {
          setSelectedState(firstState.sigla);
        }
      } catch {
        setStateOptions([]);
      }
    }

    void loadStates();
  }, []);

  useEffect(() => {
    if (!selectedState) {
      setCityOptions([]);
      setCity("");
      return;
    }

    async function loadCities() {
      try {
        const cities = await fetchCitiesByState(selectedState);
        setCityOptions(cities);
        setCity(cities[0] ?? "");
      } catch {
        setCityOptions([]);
        setCity("");
      }
    }

    void loadCities();
  }, [selectedState]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = input.trim();
    const selectedStateName =
      stateOptions.find((option) => option.sigla === selectedState)?.nome ??
      selectedState;
    const trimmedCity = city.trim();

    if ((!trimmed && !trimmedCity) || isLoading) {
      return;
    }

    const finalMessage =
      trimmed || `Qual é o clima em ${trimmedCity}, ${selectedStateName}?`;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed
        ? trimmed
        : `Clima em ${trimmedCity}, ${selectedStateName}`,
    };

    setMessages((previous) => [...previous, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: finalMessage,
          city: trimmedCity || undefined,
          state: selectedStateName || undefined,
        }),
      });

      const data = await response.json();
      console.log("data", data);
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          response.ok && data?.summary
            ? `${data.summary}\n\nRecomendação: ${data.recommendation}`
            : "Não consegui processar sua pergunta agora.",
      };

      setMessages((previous) => [...previous, assistantMessage]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Ocorreu um erro ao analisar sua decisão. Tente novamente.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/50 dark:border-slate-700 dark:bg-slate-900">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-700">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-600">
            Weather Decision AI
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">
            Assistente de decisões
          </h1>
        </div>
      </header>

      <div className="flex min-h-[360px] flex-col gap-4 overflow-y-auto rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Pensando na melhor recomendação...
            </div>
          </div>
        )}
      </div>

      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr_1fr]">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ex.: Vou sair de casa e não sei se devo levar guarda-chuva?"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none ring-0 transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsStateOpen((previous) => !previous)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-800 transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <span>
                {stateOptions.find((option) => option.sigla === selectedState)
                  ?.nome ?? "Selecione o estado"}
              </span>
              <span>▾</span>
            </button>

            {isStateOpen && (
              <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-950">
                <input
                  value={stateSearch}
                  onChange={(event) => setStateSearch(event.target.value)}
                  placeholder="Buscar estado"
                  className="mb-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <div className="max-h-52 overflow-y-auto">
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
                          setSelectedState(stateOption.sigla);
                          setIsStateOpen(false);
                          setStateSearch("");
                        }}
                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-sky-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {stateOption.nome}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsCityOpen((previous) => !previous)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-800 transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <span>{city || "Selecione a cidade"}</span>
              <span>▾</span>
            </button>

            {isCityOpen && (
              <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-950">
                <input
                  value={citySearch}
                  onChange={(event) => setCitySearch(event.target.value)}
                  placeholder="Buscar cidade"
                  className="mb-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <div className="max-h-52 overflow-y-auto">
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
                          setCity(availableCity);
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
            )}
          </div>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-sky-400"
        >
          {isLoading ? "Analisando..." : "Enviar"}
        </button>
      </form>
    </section>
  );
}
