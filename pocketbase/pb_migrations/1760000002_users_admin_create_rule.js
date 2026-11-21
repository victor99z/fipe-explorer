/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId("users");
      if (usersCol) {
        usersCol.createRule = '@request.auth.role = "admin"';
        app.save(usersCol);
      }
    } catch (_) {
      // noop
    }
  },
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId("users");
      if (usersCol) {
        usersCol.createRule =
          '(@request.body.role:isset = false || @request.body.role = "user" || @request.body.role = "") || @request.auth.role = "admin"';
        app.save(usersCol);
      }
    } catch (_) {
      // noop
    }
  },
);
