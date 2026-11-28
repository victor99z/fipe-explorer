import { describe, expect, test } from "bun:test";
import { parseCurrencyToNumber, parseMileageToKm, parseYearPair } from "../number";
import { normalizeBrand, parseCarText } from "../car-parser";

describe("number utils", () => {
  test("parses BRL prices", () => {
    expect(parseCurrencyToNumber("R$ 74.900")).toBe(74900);
    expect(parseCurrencyToNumber("R$ 128.500,00")).toBe(128500);
    expect(parseCurrencyToNumber(65000)).toBe(65000);
    expect(Number.isNaN(parseCurrencyToNumber(""))).toBe(true);
  });

  test("parses mileage values", () => {
    expect(parseMileageToKm("48.500 km")).toBe(48500);
    expect(parseMileageToKm("48 mil km")).toBe(48000);
    expect(parseMileageToKm("0 km")).toBe(0);
    expect(parseMileageToKm(32000)).toBe(32000);
  });

  test("parses year pairs and single years", () => {
    expect(parseYearPair("2020/2021")).toEqual({
      manufactureYear: 2020,
      modelYear: 2021,
    });
    expect(parseYearPair("2023")).toEqual({ modelYear: 2023 });
    expect(parseYearPair("Peugeot 2008 Allure 1.0 Turbo Flex 5P Aut. 2025")).toEqual({
      modelYear: 2025,
    });
  });
});

describe("car parser", () => {
  test("normalizes common Brazilian brands", () => {
    expect(normalizeBrand("VW - VolksWagen")).toBe("Volkswagen");
    expect(normalizeBrand("GM Chevrolet")).toBe("Chevrolet");
    expect(normalizeBrand("Citroen")).toBe("Citroën");
  });

  test("extracts specs from title and details", () => {
    const parsed = parseCarText(
      "VW Polo Highline 1.0 200 TSI Automático 2022",
      "38.000 km • Flex • Loja",
    );
    expect(parsed.brand).toBe("Volkswagen");
    expect(parsed.model).toBe("Polo");
    expect(parsed.year).toBe(2022);
    expect(parsed.mileage_km).toBe(38000);
    expect(parsed.transmission).toBe("Automático");
    expect(parsed.fuel).toBe("Flex");
    expect(parsed.engine_size).toBe("1.0");
    expect(parsed.is_turbo).toBe(true);
    expect(parsed.seller_type).toBe("Loja");

    const tiptr = parseCarText("Audi Q3 Prestige 2.0 TFSI Tiptr.quatro 2024");
    expect(tiptr.transmission).toBe("Automático");

    const hb20TurboAuto = parseCarText("Hyundai HB20 Limited 1.0 TB Flex 12V Aut. 2026");
    expect(hb20TurboAuto.is_turbo).toBe(true);
    expect(hb20TurboAuto.transmission).toBe("Automático");
    expect(hb20TurboAuto.engine_size).toBe("1.0");

    const hb20Manual = parseCarText("Hyundai HB20 Comfort 1.0 Flex 12V Mec. 2026");
    expect(hb20Manual.is_turbo).toBeUndefined();
    expect(hb20Manual.transmission).toBe("Manual");

    const voyageTotalFlex = parseCarText("Volkswagen Voyage Trendline 1.0 T.Flex 8V 4P 2015");
    expect(voyageTotalFlex.is_turbo).toBeUndefined();
  });
});
