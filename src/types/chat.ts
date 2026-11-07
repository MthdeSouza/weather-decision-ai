export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
}

export interface WeatherContext {
  city: string;
  condition: string;
  temperature: number;
  humidity: number;
  wind: number;
}
