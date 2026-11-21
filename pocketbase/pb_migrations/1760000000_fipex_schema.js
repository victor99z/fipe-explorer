/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const ADMIN_RULE = '@request.auth.role = "admin"';
  const USER_OR_ADMIN_RULE = 'user = @request.auth.id || @request.auth.role = "admin"';
  const USER_CREATE_RULE = '@request.auth.id != "" && @request.body.user = @request.auth.id';

  function findCol(name) {
    try {
      return app.findCollectionByNameOrId(name);
    } catch (_) {
      return null;
    }
  }

  function addFieldIfMissing(col, field) {
    if (!col.fields.getByName(field.name)) {
      col.fields.add(field);
    }
  }

  function addIndexIfMissing(col, indexSql) {
    const match = indexSql.match(/INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
    const idxName = match ? match[1] : "";
    if (!idxName) return;
    const exists = (col.indexes || []).some((idx) => idx.includes(idxName));
    if (!exists) {
      col.indexes.push(indexSql);
    }
  }

  function ensureBaseCollection(name, rules, fieldsFactory, indexes) {
    let col = findCol(name);
    if (!col) {
      col = new Collection({
        type: "base",
        name,
        listRule: rules.listRule !== undefined ? rules.listRule : "",
        viewRule: rules.viewRule !== undefined ? rules.viewRule : "",
        createRule: rules.createRule !== undefined ? rules.createRule : ADMIN_RULE,
        updateRule: rules.updateRule !== undefined ? rules.updateRule : ADMIN_RULE,
        deleteRule: rules.deleteRule !== undefined ? rules.deleteRule : ADMIN_RULE,
      });
    } else {
      if (rules.listRule !== undefined) col.listRule = rules.listRule;
      if (rules.viewRule !== undefined) col.viewRule = rules.viewRule;
      if (rules.createRule !== undefined) col.createRule = rules.createRule;
      if (rules.updateRule !== undefined) col.updateRule = rules.updateRule;
      if (rules.deleteRule !== undefined) col.deleteRule = rules.deleteRule;
    }

    for (const field of fieldsFactory()) {
      addFieldIfMissing(col, field);
    }

    if (indexes) {
      for (const idx of indexes) {
        addIndexIfMissing(col, idx);
      }
    }

    app.save(col);
    return col;
  }

  // 1. Enhance built-in users collection with role & alert preferences
  const usersCol = findCol("users");
  if (usersCol) {
    addFieldIfMissing(usersCol, new TextField({ name: "role", required: false, max: 32 }));
    addFieldIfMissing(usersCol, new BoolField({ name: "alerts_enabled", required: false }));
    usersCol.listRule = 'id = @request.auth.id || @request.auth.role = "admin"';
    usersCol.viewRule = 'id = @request.auth.id || @request.auth.role = "admin"';
    usersCol.createRule = ADMIN_RULE;
    usersCol.updateRule = '(id = @request.auth.id && (@request.body.role:isset = false || @request.body.role = role)) || @request.auth.role = "admin"';
    usersCol.deleteRule = ADMIN_RULE;
    app.save(usersCol);
  }

  // 2. car_listings (crawler portal targets)
  const listingsCol = ensureBaseCollection(
    "car_listings",
    {
      listRule: ADMIN_RULE,
      viewRule: ADMIN_RULE,
      createRule: ADMIN_RULE,
      updateRule: ADMIN_RULE,
      deleteRule: ADMIN_RULE,
    },
    () => [
      new TextField({ name: "name", required: true }),
      new BoolField({ name: "active" }),
      new NumberField({ name: "last_page" }),
      new TextField({ name: "url" }),
      new NumberField({ name: "max_pages" }),
      new NumberField({ name: "delay_ms" }),
      new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
      new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
    ],
    []
  );

  // Seed default car_listings if empty
  const existingListings = app.findRecordsByFilter("car_listings", "", "", 10, 0);
  if (existingListings.length === 0) {
    const seeds = [
      {
        name: "olx-carros",
        active: true,
        last_page: 1,
        url: "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/estado-sc/norte-de-santa-catarina",
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
        url: "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/estado-sc/blumenau",
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
        name: "olx-jaragua-do-sul",
        active: true,
        last_page: 1,
        url: "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/estado-sc/jaragua-do-sul",
        max_pages: 20,
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
    for (const seed of seeds) {
      const rec = new Record(listingsCol);
      rec.set("name", seed.name);
      rec.set("active", seed.active);
      rec.set("last_page", seed.last_page);
      rec.set("url", seed.url);
      rec.set("max_pages", seed.max_pages);
      rec.set("delay_ms", seed.delay_ms);
      app.save(rec);
    }
  }

  // 3. carros_temp (current scraped listings + lifecycle summary)
  ensureBaseCollection(
    "carros_temp",
    {
      listRule: "",
      viewRule: "",
      createRule: ADMIN_RULE,
      updateRule: ADMIN_RULE,
      deleteRule: ADMIN_RULE,
    },
    () => [
      new TextField({ name: "ref", required: true }),
      new TextField({ name: "text_description" }),
      new JSONField({ name: "features" }),
      new TextField({ name: "id_listing" }),
      new FileField({
        name: "images",
        maxSelect: 10,
        maxSize: 10485760,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"],
      }),
      new JSONField({ name: "image_urls" }),
      new NumberField({ name: "price" }),
      new NumberField({ name: "year" }),
      new NumberField({ name: "mileage_km" }),
      new TextField({ name: "brand" }),
      new TextField({ name: "model" }),
      new TextField({ name: "version" }),
      new TextField({ name: "transmission" }),
      new TextField({ name: "fuel" }),
      new TextField({ name: "color" }),
      new TextField({ name: "body_type" }),
      new TextField({ name: "engine_size" }),
      new BoolField({ name: "is_turbo" }),
      new TextField({ name: "seller_type" }),
      new TextField({ name: "neighborhood" }),
      new TextField({ name: "city" }),
      new TextField({ name: "state" }),
      new NumberField({ name: "fipe_price" }),
      new TextField({ name: "fipe_code" }),
      new TextField({ name: "fipe_brand" }),
      new TextField({ name: "fipe_model" }),
      new NumberField({ name: "fipe_year" }),
      new TextField({ name: "fipe_ref_period" }),
      new NumberField({ name: "fipe_diff_pct" }),
      new BoolField({ name: "is_favorite" }),
      new BoolField({ name: "is_hidden" }),
      new TextField({ name: "notes" }),
      new DateField({ name: "first_seen_at" }),
      new DateField({ name: "last_seen_at" }),
      new NumberField({ name: "initial_price" }),
      new NumberField({ name: "lowest_price" }),
      new NumberField({ name: "highest_price" }),
      new NumberField({ name: "price_changes_count" }),
      new DateField({ name: "last_price_change_at" }),
      new TextField({ name: "listing_status" }),
      new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
      new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
    ],
    [
      "CREATE INDEX idx_carros_ref ON carros_temp (ref)",
      "CREATE INDEX idx_carros_updated ON carros_temp (updated DESC)",
      "CREATE INDEX idx_carros_city_price ON carros_temp (city, price)",
      "CREATE INDEX idx_carros_brand_year ON carros_temp (brand, year)",
      "CREATE INDEX idx_carros_model_year ON carros_temp (brand, model, year)",
      "CREATE INDEX idx_carros_filters ON carros_temp (city, brand, transmission, fuel, is_turbo, engine_size, year, price)",
      "CREATE INDEX idx_carros_fipe ON carros_temp (fipe_price, fipe_diff_pct)",
      "CREATE INDEX idx_carros_fipe_code ON carros_temp (fipe_code)",
      "CREATE INDEX idx_carros_mileage ON carros_temp (mileage_km)",
      "CREATE INDEX idx_carros_status_seen ON carros_temp (listing_status, last_seen_at DESC)",
    ]
  );

  // 4. carros_history (historical price & mileage snapshots per ad/model)
  ensureBaseCollection(
    "carros_history",
    {
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: ADMIN_RULE,
      updateRule: ADMIN_RULE,
      deleteRule: ADMIN_RULE,
    },
    () => [
      new TextField({ name: "carro_id" }),
      new TextField({ name: "ref", required: true }),
      new TextField({ name: "id_listing" }),
      new TextField({ name: "portal" }),
      new TextField({ name: "text_description" }),
      new TextField({ name: "brand" }),
      new TextField({ name: "model" }),
      new TextField({ name: "version" }),
      new NumberField({ name: "year" }),
      new NumberField({ name: "manufacture_year" }),
      new NumberField({ name: "price" }),
      new NumberField({ name: "previous_price" }),
      new NumberField({ name: "price_delta" }),
      new NumberField({ name: "mileage_km" }),
      new NumberField({ name: "previous_mileage_km" }),
      new TextField({ name: "transmission" }),
      new TextField({ name: "fuel" }),
      new TextField({ name: "engine_size" }),
      new BoolField({ name: "is_turbo" }),
      new TextField({ name: "seller_type" }),
      new TextField({ name: "neighborhood" }),
      new TextField({ name: "city" }),
      new TextField({ name: "state" }),
      new NumberField({ name: "fipe_price" }),
      new TextField({ name: "fipe_code" }),
      new TextField({ name: "fipe_brand" }),
      new TextField({ name: "fipe_model" }),
      new NumberField({ name: "fipe_year" }),
      new TextField({ name: "fipe_ref_period" }),
      new NumberField({ name: "fipe_diff_pct" }),
      new TextField({ name: "event_type" }),
      new DateField({ name: "recorded_at" }),
      new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
      new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
    ],
    [
      "CREATE INDEX idx_history_ref_date ON carros_history (ref, recorded_at DESC)",
      "CREATE INDEX idx_history_carro_date ON carros_history (carro_id, recorded_at DESC)",
      "CREATE INDEX idx_history_brand_model_year ON carros_history (brand, model, year)",
      "CREATE INDEX idx_history_fipe_year ON carros_history (fipe_code, year)",
      "CREATE INDEX idx_history_recorded_at ON carros_history (recorded_at DESC)",
    ]
  );

  // 5. user_car_curation (per-user favorites, hidden ads & notes)
  if (usersCol) {
    ensureBaseCollection(
      "user_car_curation",
      {
        listRule: USER_OR_ADMIN_RULE,
        viewRule: USER_OR_ADMIN_RULE,
        createRule: USER_CREATE_RULE,
        updateRule: USER_OR_ADMIN_RULE,
        deleteRule: USER_OR_ADMIN_RULE,
      },
      () => [
        new RelationField({
          name: "user",
          required: true,
          maxSelect: 1,
          collectionId: usersCol.id,
          cascadeDelete: true,
        }),
        new TextField({ name: "carro_id", required: true }),
        new TextField({ name: "car_ref" }),
        new BoolField({ name: "is_favorite" }),
        new BoolField({ name: "is_hidden" }),
        new TextField({ name: "notes" }),
        new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
        new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
      ],
      [
        "CREATE UNIQUE INDEX idx_user_curation_unique ON user_car_curation (user, carro_id)",
        "CREATE INDEX idx_user_curation_user ON user_car_curation (user, is_favorite, is_hidden)",
      ]
    );

    // 6. car_alerts (saved alerts for logged-in users)
    const alertsCol = ensureBaseCollection(
      "car_alerts",
      {
        listRule: USER_OR_ADMIN_RULE,
        viewRule: USER_OR_ADMIN_RULE,
        createRule: USER_CREATE_RULE,
        updateRule: USER_OR_ADMIN_RULE,
        deleteRule: USER_OR_ADMIN_RULE,
      },
      () => [
        new RelationField({
          name: "user",
          required: true,
          maxSelect: 1,
          collectionId: usersCol.id,
          cascadeDelete: true,
        }),
        new TextField({ name: "name", required: true }),
        new BoolField({ name: "active" }),
        new TextField({ name: "search_query" }),
        new TextField({ name: "brand" }),
        new TextField({ name: "model" }),
        new TextField({ name: "version" }),
        new TextField({ name: "fipe_code" }),
        new TextField({ name: "city" }),
        new TextField({ name: "portal" }),
        new TextField({ name: "motorizacao" }),
        new TextField({ name: "transmission" }),
        new TextField({ name: "fuel" }),
        new NumberField({ name: "min_year" }),
        new NumberField({ name: "max_year" }),
        new NumberField({ name: "min_price" }),
        new NumberField({ name: "max_price" }),
        new NumberField({ name: "max_km" }),
        new BoolField({ name: "only_below_fipe" }),
        new NumberField({ name: "min_fipe_discount_pct" }),
        new BoolField({ name: "notify_on_new" }),
        new BoolField({ name: "notify_on_price_drop" }),
        new DateField({ name: "last_checked_at" }),
        new DateField({ name: "last_matched_at" }),
        new NumberField({ name: "matches_count" }),
        new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
        new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
      ],
      ["CREATE INDEX idx_car_alerts_user_active ON car_alerts (user, active)"]
    );

    // 7. car_alert_notifications (alert match notifications)
    ensureBaseCollection(
      "car_alert_notifications",
      {
        listRule: USER_OR_ADMIN_RULE,
        viewRule: USER_OR_ADMIN_RULE,
        createRule: '@request.auth.id != "" && (@request.body.user = @request.auth.id || @request.auth.role = "admin")',
        updateRule: USER_OR_ADMIN_RULE,
        deleteRule: USER_OR_ADMIN_RULE,
      },
      () => [
        new RelationField({
          name: "user",
          required: true,
          maxSelect: 1,
          collectionId: usersCol.id,
          cascadeDelete: true,
        }),
        new RelationField({
          name: "alert",
          required: true,
          maxSelect: 1,
          collectionId: alertsCol.id,
          cascadeDelete: true,
        }),
        new TextField({ name: "carro_id" }),
        new TextField({ name: "car_ref", required: true }),
        new TextField({ name: "car_title" }),
        new TextField({ name: "brand" }),
        new TextField({ name: "model" }),
        new NumberField({ name: "year" }),
        new NumberField({ name: "mileage_km" }),
        new NumberField({ name: "price" }),
        new NumberField({ name: "previous_price" }),
        new NumberField({ name: "fipe_price" }),
        new NumberField({ name: "fipe_diff_pct" }),
        new TextField({ name: "portal" }),
        new TextField({ name: "city" }),
        new TextField({ name: "trigger_type" }),
        new TextField({ name: "dedup_key", required: true }),
        new BoolField({ name: "is_read" }),
        new DateField({ name: "read_at" }),
        new DateField({ name: "triggered_at" }),
        new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
        new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
      ],
      [
        "CREATE INDEX idx_alert_notif_user_read ON car_alert_notifications (user, is_read, triggered_at DESC)",
        "CREATE UNIQUE INDEX idx_alert_notif_dedup ON car_alert_notifications (dedup_key)",
      ]
    );
  }

  // 8. car_crawler_runs & car_crawler_logs (admin-only)
  ensureBaseCollection(
    "car_crawler_runs",
    {
      listRule: ADMIN_RULE,
      viewRule: ADMIN_RULE,
      createRule: ADMIN_RULE,
      updateRule: ADMIN_RULE,
      deleteRule: ADMIN_RULE,
    },
    () => [
      new TextField({ name: "site_name", required: true }),
      new DateField({ name: "started_at" }),
      new DateField({ name: "finished_at" }),
      new TextField({ name: "status" }),
      new NumberField({ name: "pages_crawled" }),
      new NumberField({ name: "listings_scraped" }),
      new NumberField({ name: "errors" }),
      new TextField({ name: "error_msg" }),
      new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
      new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
    ],
    []
  );

  ensureBaseCollection(
    "car_crawler_logs",
    {
      listRule: ADMIN_RULE,
      viewRule: ADMIN_RULE,
      createRule: ADMIN_RULE,
      updateRule: ADMIN_RULE,
      deleteRule: ADMIN_RULE,
    },
    () => [
      new TextField({ name: "level", required: true }),
      new TextField({ name: "message", required: true }),
      new JSONField({ name: "context" }),
      new DateField({ name: "created_at" }),
      new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
      new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
    ],
    []
  );
}, (app) => {
  // Down migration left intentionally non-destructive for existing market history data
});
