/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId("carros_history");
      if (col) {
        col.listRule = '@request.auth.id != ""';
        col.viewRule = '@request.auth.id != ""';
        app.save(col);
      }
    } catch (_) {
      // Collection does not exist yet; created by 1760000000_fipex_schema.js
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId("carros_history");
      if (col) {
        col.listRule = "";
        col.viewRule = "";
        app.save(col);
      }
    } catch (_) {
      // noop
    }
  },
);
