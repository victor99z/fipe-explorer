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

      const oldBlumenauUrl =
        "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/estado-sc/regiao-de-blumenau";
      const validBlumenauUrl =
        "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/estado-sc/blumenau";

      const blumenau = byName.get("olx-blumenau");
      if (blumenau && blumenau.getString("url") === oldBlumenauUrl) {
        blumenau.set("url", validBlumenauUrl);
        app.save(blumenau);
      }

      if (!byName.has("olx-jaragua-do-sul")) {
        const rec = new Record(col);
        rec.set("name", "olx-jaragua-do-sul");
        rec.set("active", true);
        rec.set("last_page", 1);
        rec.set(
          "url",
          "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/estado-sc/jaragua-do-sul",
        );
        rec.set("max_pages", 20);
        rec.set("delay_ms", 2500);
        app.save(rec);
      }
    } catch (_) {
      // noop
    }
  },
  () => {
    // Reversible no-op
  },
);
