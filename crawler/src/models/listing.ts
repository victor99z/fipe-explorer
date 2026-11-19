export type { CarFeatures } from "./carro";

export interface SeedListing {
  id: string;
  name: string;
  active: boolean;
  lastPage: number;
  url: string;
  maxPages: number;
  delayMs: number;
}
