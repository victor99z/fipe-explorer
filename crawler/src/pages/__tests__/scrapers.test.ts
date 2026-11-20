import { describe, expect, test } from "bun:test";
import {
  isValidOlxCarUrl,
  mapOlxCarCard,
  parseOlxNextData,
} from "../olx-carros";
import {
  isValidWebmotorsCarUrl,
  mapWebmotorsCarCard,
  parseWebmotorsNextData,
} from "../webmotors-carros";
import { parseCarJsonLdBlocks } from "../extractors";

describe("OLX carros scraper", () => {
  test("validates OLX car URLs and rejects recommendation/invalid URLs", () => {
    expect(
      isValidOlxCarUrl(
        "https://sc.olx.com.br/norte-de-santa-catarina/autos-e-pecas/carros-vans-e-utilitarios/honda-civic-2020-1234567890",
      ),
    ).toBe(true);
    expect(
      isValidOlxCarUrl("https://www.olx.com.br/vi/123456?rec=true"),
    ).toBe(false);
    expect(
      isValidOlxCarUrl(
        "https://www.olx.com.br/imoveis/apartamento-joinville-123",
      ),
    ).toBe(false);
    expect(
      isValidOlxCarUrl(
        "https://sc.olx.com.br/norte-de-santa-catarina/autos-e-pecas/motos/honda-cg-160-titan-12345",
      ),
    ).toBe(false);
    expect(
      isValidOlxCarUrl(
        "https://sc.olx.com.br/norte-de-santa-catarina/autos-e-pecas/pecas-e-acessorios/roda-aro-17-12345",
      ),
    ).toBe(false);
  });

  test("rejects motorcycles and parts even under car URLs", () => {
    expect(
      mapOlxCarCard({
        title: "Honda CG 160 Titan 2023",
        href: "/norte-de-santa-catarina/autos-e-pecas/carros-vans-e-utilitarios/honda-cg-160-123",
        address: "Joinville, Centro",
        price: "R$ 17.500",
        details: "12.000 km",
        seller: "Particular",
        image: "",
      }),
    ).toBeNull();

    expect(
      mapOlxCarCard({
        title: "Yamaha Fazer 250 ABS 2022",
        href: "/norte-de-santa-catarina/autos-e-pecas/carros-vans-e-utilitarios/yamaha-fazer-250-123",
        address: "Joinville, Centro",
        price: "R$ 21.000",
        details: "9.000 km",
        seller: "Loja",
        image: "",
      }),
    ).toBeNull();
  });

  test("maps OLX DOM card", () => {
    const mapped = mapOlxCarCard({
      title: "Honda Civic Touring 1.5 Turbo 2021",
      href: "/norte-de-santa-catarina/autos-e-pecas/carros-vans-e-utilitarios/honda-civic-123456?utm_source=test",
      address: "Joinville, América - SC",
      price: "R$ 139.900",
      details: "42.000 km Automático Gasolina",
      seller: "Profissional",
      image: "/_next/image?url=https%3A%2F%2Fstatic.olx.com.br%2Fsxp%2Flisting%2Fstores%2Fverified_official_store_icon.webp&w=32&q=70",
      images: [
        "/_next/image?url=https%3A%2F%2Fstatic.olx.com.br%2Fsxp%2Flisting%2Fstores%2Fverified_official_store_icon.webp&w=32&q=70",
        "https://img.olx.com.br/images/12/123.jpg",
      ],
    });

    expect(mapped).not.toBeNull();
    expect(mapped?.ref).toBe(
      "https://www.olx.com.br/norte-de-santa-catarina/autos-e-pecas/carros-vans-e-utilitarios/honda-civic-123456",
    );
    expect(mapped?.features.price).toBe(139900);
    expect(mapped?.features.brand).toBe("Honda");
    expect(mapped?.features.year).toBe(2021);
    expect(mapped?.features.mileage_km).toBe(42000);
    expect(mapped?.features.transmission).toBe("Automático");
    expect(mapped?.features.fuel).toBe("Gasolina");
    expect(mapped?.features.neighborhood).toBe("América");
    expect(mapped?.features.city).toBe("Joinville");
    expect(mapped?.features.seller_type).toBe("Loja");
    expect(mapped?.images).toEqual(["https://img.olx.com.br/images/12/123.jpg"]);
  });

  test("parses OLX __NEXT_DATA__", () => {
    const items = parseOlxNextData({
      props: {
        pageProps: {
          ads: [
            {
              listId: 998877,
              subject: "Chevrolet Onix Premier 1.0 Turbo 2023",
              price: "R$ 92.500",
              url: "https://sc.olx.com.br/norte-de-santa-catarina/autos-e-pecas/carros-vans-e-utilitarios/onix-premier-998877",
              location: "Joinville, Saguaçu - SC",
              professionalAd: false,
              properties: [
                { name: "vehicle_brand", value: "GM - Chevrolet" },
                { name: "vehicle_model", value: "Onix" },
                { name: "regdate", value: "2023" },
                { name: "mileage", value: "21000" },
                { name: "gearbox", value: "Automático" },
                { name: "fuel", value: "Flex" },
              ],
              images: [{ original: "https://img.olx.com.br/onix.jpg" }],
            },
          ],
        },
      },
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.features.brand).toBe("Chevrolet");
    expect(items[0]?.features.model).toBe("Onix");
    expect(items[0]?.features.year).toBe(2023);
    expect(items[0]?.features.mileage_km).toBe(21000);
    expect(items[0]?.features.seller_type).toBe("Particular");
  });
});

describe("Webmotors carros scraper", () => {
  test("validates Webmotors URLs", () => {
    expect(
      isValidWebmotorsCarUrl(
        "https://www.webmotors.com.br/comprar/toyota/corolla/20-vvt-ie-flex-xei-direct-shift/4-portas/2022/55123456",
      ),
    ).toBe(true);
    expect(
      isValidWebmotorsCarUrl("https://www.webmotors.com.br/carros/sc-joinville"),
    ).toBe(false);
  });

  test("maps Webmotors DOM card", () => {
    const mapped = mapWebmotorsCarCard({
      title: "Toyota Corolla XEi 2.0 Flex 2022",
      href: "/comprar/toyota/corolla/xei/4-portas/2022/55123456?pos=1",
      address: "Joinville - SC",
      price: "R$ 129.900",
      details: "2021/2022 35.000 km CVT",
      seller: "Concessionária",
      image: "https://image.webmotors.com.br/_fotos/corolla.jpg",
    });

    expect(mapped).not.toBeNull();
    expect(mapped?.features.brand).toBe("Toyota");
    expect(mapped?.features.price).toBe(129900);
    expect(mapped?.features.year).toBe(2022);
    expect(mapped?.features.mileage_km).toBe(35000);
    expect(mapped?.features.transmission).toBe("CVT");
    expect(mapped?.features.seller_type).toBe("Loja");
  });

  test("parses Webmotors __NEXT_DATA__", () => {
    const items = parseWebmotorsNextData({
      props: {
        pageProps: {
          searchResult: {
            SearchResults: [
              {
                UniqueId: 44332211,
                Specification: {
                  Make: { Value: "JEEP" },
                  Model: { Value: "COMPASS" },
                  Version: { Value: "1.3 T270 TURBO FLEX LONGITUDE AT6" },
                  YearFabrication: 2022,
                  YearModel: 2023,
                  Odometer: 28400,
                  Transmission: "Automática",
                  Fuel: "Gasolina e álcool",
                  Color: "Branco",
                  BodyType: "SUV",
                },
                Prices: {
                  Price: 138900,
                  FipePrice: 145000,
                },
                Seller: {
                  SellerType: "Loja",
                  City: "Joinville",
                  State: "SC",
                  Neighborhood: "Centro",
                },
                Media: {
                  Photos: [{ PhotoPath: "2023/compass/foto1.jpg" }],
                },
              },
            ],
          },
        },
      },
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.features.brand).toBe("Jeep");
    expect(items[0]?.features.model).toBe("COMPASS");
    expect(items[0]?.features.year).toBe(2023);
    expect(items[0]?.features.mileage_km).toBe(28400);
    expect(items[0]?.features.fipe_price).toBe(145000);
    expect(items[0]?.features.neighborhood).toBe("Centro");
    expect(items[0]?.images?.[0]).toContain("image.webmotors.com.br");
  });

  test("parses JSON-LD ItemList of Cars", () => {
    const items = parseCarJsonLdBlocks([
      {
        "@type": "ItemList",
        itemListElement: [
          {
            "@type": "ListItem",
            item: {
              "@type": "Car",
              name: "Hyundai HB20 Comfort 1.0 2021",
              url: "https://www.webmotors.com.br/comprar/hyundai/hb20/2021/123",
              brand: { "@type": "Brand", name: "Hyundai" },
              model: "HB20",
              vehicleModelDate: "2021",
              mileageFromOdometer: { value: 45000 },
              offers: { price: 62900 },
            },
          },
        ],
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]?.features.brand).toBe("Hyundai");
    expect(items[0]?.features.price).toBe(62900);
    expect(items[0]?.features.mileage_km).toBe(45000);
  });
});
