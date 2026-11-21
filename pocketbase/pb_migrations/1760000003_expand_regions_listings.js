/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId("car_listings");
      if (!col) return;

      const existing = app.findRecordsByFilter("car_listings", "", "", 200, 0);
      const byName = new Map();
      for (const rec of existing) {
        byName.set(rec.getString("name"), rec);
      }

      const regionalOlxNorteSc =
        "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/estado-sc/norte-de-santa-catarina";
      const legacyJoinvilleUrl =
        "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/estado-sc/norte-de-santa-catarina/joinville";

      const olxBase = byName.get("olx-carros");
      if (olxBase && olxBase.getString("url") === legacyJoinvilleUrl) {
        olxBase.set("url", regionalOlxNorteSc);
        app.save(olxBase);
      }

      const targets = [
        {
          name: "olx-carros",
          active: true,
          last_page: 1,
          url: regionalOlxNorteSc,
          max_pages: 50,
          delay_ms: 2500,
        },
        {
          name: "webmotors-carros",
          active: true,
          last_page: 1,
          url: "https://www.webmotors.com.br/carros/sc-joinville=1?tipoveiculo=carros&estadocidade=Santa%20Catarina-joinville%3D1&page=1",
          max_pages: 50,
          delay_ms: 2500,
        },
        {
          name: "olx-curitiba",
          active: true,
          last_page: 1,
          url: "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/estado-pr/curitiba",
          max_pages: 30,
          delay_ms: 2500,
        },
        {
          name: "webmotors-curitiba",
          active: true,
          last_page: 1,
          url: "https://www.webmotors.com.br/carros/pr-curitiba",
          max_pages: 30,
          delay_ms: 2500,
        },
        {
          name: "olx-blumenau",
          active: true,
          last_page: 1,
          url: "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/estado-sc/regiao-de-blumenau",
          max_pages: 25,
          delay_ms: 2500,
        },
        {
          name: "webmotors-blumenau",
          active: true,
          last_page: 1,
          url: "https://www.webmotors.com.br/carros/sc-blumenau",
          max_pages: 25,
          delay_ms: 2500,
        },
        {
          name: "webmotors-jaragua-do-sul",
          active: true,
          last_page: 1,
          url: "https://www.webmotors.com.br/carros/sc-jaragua-do-sul",
          max_pages: 20,
          delay_ms: 2500,
        },
        {
          name: "olx-florianopolis",
          active: true,
          last_page: 1,
          url: "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/estado-sc/florianopolis-e-regiao",
          max_pages: 25,
          delay_ms: 2500,
        },
        {
          name: "webmotors-florianopolis",
          active: true,
          last_page: 1,
          url: "https://www.webmotors.com.br/carros/sc-florianopolis",
          max_pages: 25,
          delay_ms: 2500,
        },
      ];

      for (const seed of targets) {
        if (byName.has(seed.name)) continue;
        const rec = new Record(col);
        rec.set("name", seed.name);
        rec.set("active", seed.active);
        rec.set("last_page", seed.last_page);
        rec.set("url", seed.url);
        rec.set("max_pages", seed.max_pages);
        rec.set("delay_ms", seed.delay_ms);
        app.save(rec);
      }
    } catch (_) {
      // noop
    }
  },
  () => {
    // Reversible seed migration intentionally preserves regional car_listings
  },
);
