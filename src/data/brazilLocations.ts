import { BRAZIL_STATES } from "@/data/brazilStates";

export type BrazilStateOption = {
  id: number;
  nome: string;
  sigla: string;
};

export type BrazilCityOption = {
  id: number;
  nome: string;
};

const normalizeCityName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");

export function getDefaultCityForState(
  stateUf: string,
  cities: string[],
): string {
  const capital = BRAZIL_STATES.find(
    (state) => state.uf === stateUf.toUpperCase(),
  )?.city;

  if (!capital) {
    return cities[0] ?? "";
  }

  return (
    cities.find(
      (city) => normalizeCityName(city) === normalizeCityName(capital),
    ) ??
    cities[0] ??
    ""
  );
}

export async function fetchBrazilStates(): Promise<BrazilStateOption[]> {
  const response = await fetch(
    "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome",
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar os estados do IBGE.");
  }

  return (await response.json()) as BrazilStateOption[];
}

export async function fetchCitiesByState(stateUf: string): Promise<string[]> {
  const response = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateUf}/municipios`,
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar as cidades do IBGE.");
  }

  const cities = (await response.json()) as BrazilCityOption[];
  return cities
    .map((city) => city.nome)
    .sort((first, second) => first.localeCompare(second));
}
