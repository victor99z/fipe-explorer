/// <reference path="../pb_data/types.d.ts" />

// Seed an admin user account in `users` matching POCKETBASE_EMAIL / POCKETBASE_PASSWORD
// when configured, so the same admin credentials can log into the website UI.
$app.onServe().bindFunc((e) => {
  try {
    const email = ($os.getenv("POCKETBASE_EMAIL") || "").trim();
    const password = $os.getenv("POCKETBASE_PASSWORD") || "";
    if (email && password.length >= 8) {
      const usersCol = $app.findCollectionByNameOrId("users");
      if (usersCol) {
        let existing = null;
        try {
          existing = $app.findAuthRecordByEmail(usersCol, email);
        } catch (_) {
          existing = null;
        }

        if (existing) {
          let dirty = false;
          if (existing.getString("role") !== "admin") {
            existing.set("role", "admin");
            dirty = true;
          }
          if (!existing.getBool("alerts_enabled")) {
            existing.set("alerts_enabled", true);
            dirty = true;
          }
          if (dirty) {
            $app.save(existing);
          }
        } else {
          const rec = new Record(usersCol);
          rec.setEmail(email);
          rec.setPassword(password);
          rec.setVerified(true);
          rec.set("name", "Administrador");
          rec.set("role", "admin");
          rec.set("alerts_enabled", true);
          $app.save(rec);
        }
      }
    }
  } catch (err) {
    console.log("[fipex pb_hooks] admin seed skipped:", err && err.message ? err.message : String(err));
  }

  return e.next();
});

// Defense-in-depth: disallow public self-signup on `users`; accounts must be
// provisioned manually via PocketBase Admin UI (superuser) or by an admin.
onRecordCreateRequest((e) => {
  const isSuperuser = typeof e.hasSuperuserAuth === "function" && e.hasSuperuserAuth();
  const isAdmin = e.auth && typeof e.auth.getString === "function" && e.auth.getString("role") === "admin";
  if (!isSuperuser && !isAdmin) {
    throw new ForbiddenError("Criação pública de contas está desabilitada.");
  }
  return e.next();
}, "users");
