#!/usr/bin/env python3
"""
Reprocessa o match FIPE de anuncios ja salvos no PocketBase usando o motor
atualizado em `backend.domain.fipe_matcher`.

Suporta tres modos:
  1. Volume Docker dev (padrao): atualiza `data.db` dentro do volume `pb-dev-data`
     com parada/reinicio seguro do container PocketBase.
  2. Arquivo SQLite local (`--db-path`) ou seed `.zip` (`--seed-zip`).
  3. Instancia PocketBase remota/ativa via HTTP API (`--pb-url`).

Exemplos:
  # Simular (dry-run) no volume dev do docker-compose.dev.yml
  python3 scripts/rematch_fipe.py --dry-run

  # Aplicar no volume dev do docker-compose.dev.yml
  python3 scripts/rematch_fipe.py

  # Aplicar tambem em backup/fipex_dev_seed.zip
  python3 scripts/rematch_fipe.py --seed-zip backup/fipex_dev_seed.zip

  # Aplicar em producao via API do PocketBase (usa POCKETBASE_URL/EMAIL/PASSWORD do .env)
  python3 scripts/rematch_fipe.py --pb-url https://pb.victorbernardes.dev --dry-run
"""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import duckdb  # noqa: E402

from backend.domain.fipe_matcher import (  # noqa: E402
    YearCatalogBucket,
    build_fipe_catalog_entry,
    build_year_buckets,
    match_listings_against_catalog,
)


def git_common_repo_root(start: Path) -> Optional[Path]:
    try:
        res = subprocess.run(
            ["git", "-C", str(start), "rev-parse", "--git-common-dir"],
            capture_output=True,
            text=True,
            check=True,
        )
        common_dir = Path(res.stdout.strip())
        common_dir = (start / common_dir).resolve() if not common_dir.is_absolute() else common_dir.resolve()
        if common_dir.name == ".git":
            return common_dir.parent
    except (subprocess.SubprocessError, OSError):
        return None
    return None


def discover_parquet_file() -> Optional[Path]:
    roots = [REPO_ROOT]
    common = git_common_repo_root(REPO_ROOT)
    if common and common != REPO_ROOT:
        roots.append(common)

    for root in roots:
        for rel in ("data/fipex-prices-enriched.parquet", "data/fipex-prices.parquet"):
            candidate = root / rel
            if candidate.is_file():
                return candidate
    return None


def load_fipe_catalog(parquet_path: Path) -> Dict[int, YearCatalogBucket]:
    t0 = time.monotonic()
    con = duckdb.connect(":memory:")
    try:
        rows = con.execute(
            f"""
            WITH latest_ref AS (
                SELECT ano_referencia, mes_referencia
                FROM '{parquet_path}'
                WHERE tipo_veiculo = 'carro'
                ORDER BY ano_referencia DESC, mes_referencia DESC
                LIMIT 1
            )
            SELECT
                p.codigo_fipe,
                p.nome_marca,
                p.nome_modelo,
                CAST(p.ano_modelo AS INT) AS ano_modelo,
                p.nome_combustivel,
                p.valor_centavos / 100.0 AS valor,
                p.mes_referencia,
                p.ano_referencia
            FROM '{parquet_path}' p
            CROSS JOIN latest_ref lr
            WHERE p.tipo_veiculo = 'carro'
              AND p.ano_referencia = lr.ano_referencia
              AND p.mes_referencia = lr.mes_referencia
              AND CAST(p.ano_modelo AS INT) BETWEEN 1960 AND 2030
              AND p.valor_centavos > 0
            """
        ).fetchall()
    finally:
        con.close()

    entries = [
        build_fipe_catalog_entry(
            codigo_fipe=r[0],
            nome_marca=r[1],
            nome_modelo=r[2],
            ano_modelo=int(r[3]),
            nome_combustivel=r[4],
            valor=float(r[5]),
            mes_referencia=int(r[6]),
            ano_referencia=int(r[7]),
        )
        for r in rows
    ]
    buckets = build_year_buckets(entries)
    print(f"Catalogo FIPE carregado ({len(entries):,} versoes de {parquet_path.name}) em {time.monotonic() - t0:.2f}s")
    return buckets


def compute_diff_pct(price: Any, fipe_price: Any) -> float:
    try:
        p = float(price)
        fp = float(fipe_price)
    except (TypeError, ValueError):
        return 0.0
    if p <= 0 or fp <= 0:
        return 0.0
    return round(((p - fp) / fp) * 1000.0) / 10.0


def repair_peugeot_2008_year(title: str, brand: str, year: int) -> int:
    """Corrige anuncios de Peugeot 2008 cujo ano foi extraido erroneamente como 2008."""
    if year != 2008:
        return year
    if "peugeot" not in f"{brand} {title}".lower() or not re.search(r"\bpeugeot\s+2008\b", title, re.I):
        return year
    cleaned = re.sub(r"\bpeugeot\s+2008\b", "peugeot ", title, flags=re.I)
    years = re.findall(r"\b(201[3-9]|202[0-9]|2030)\b", cleaned)
    return int(years[-1]) if years else year


def rematch_sqlite_db(
    db_path: Path,
    catalog: Dict[int, YearCatalogBucket],
    dry_run: bool = False,
    update_history: bool = True,
    show_samples: int = 12,
) -> Dict[str, int]:
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        rows = cur.execute(
            """
            SELECT id, text_description, brand, model, version, year, transmission, fuel,
                   price, fipe_code, fipe_brand, fipe_model, fipe_year, fipe_price, fipe_ref_period, fipe_diff_pct
            FROM carros_temp
            WHERE year > 0
            """
        ).fetchall()

        items: List[Dict[str, Any]] = []
        repaired_years: Dict[str, int] = {}
        for r in rows:
            cid, desc, brand, model, ver, yr, trans, fuel = r[0], r[1] or "", r[2] or "", r[3] or "", r[4] or "", int(r[5]), r[6] or "", r[7] or ""
            fixed_yr = repair_peugeot_2008_year(desc, brand, yr)
            if fixed_yr != yr:
                repaired_years[cid] = fixed_yr
            items.append(
                {
                    "id": cid,
                    "title": desc,
                    "brand": brand,
                    "model": model,
                    "version": ver,
                    "year": fixed_yr,
                    "transmission": trans,
                    "fuel": fuel,
                }
            )

        t0 = time.monotonic()
        matches = match_listings_against_catalog(items, catalog)
        print(f"Match calculado para {len(matches):,}/{len(items):,} registros em {time.monotonic() - t0:.2f}s")

        changed_code = 0
        changed_price_only = 0
        newly_matched = 0
        repaired_year_count = len(repaired_years)
        samples: List[Tuple[str, int, float, str, str, float, str, str, float]] = []
        updates: List[Tuple[Any, ...]] = []
        fipe_by_carro_id: Dict[str, Tuple[Any, ...]] = {}

        for r in rows:
            cid, desc, _, _, _, old_yr, _, _, price, old_code, old_fbrand, old_fmodel, old_fyear, old_fprice, old_ref, old_diff = r
            nm = matches.get(cid)
            if not nm:
                continue

            new_yr = repaired_years.get(cid, int(old_yr))
            new_code = nm["codigo_fipe"]
            new_brand = nm["nome_marca"]
            new_model = nm["nome_modelo"]
            new_fyear = int(nm["ano_modelo"])
            new_price = float(nm["valor"])
            new_ref = nm["periodo_referencia"]
            new_diff = compute_diff_pct(price, new_price)

            fipe_by_carro_id[cid] = (new_price, new_code, new_brand, new_model, new_fyear, new_ref, cid)

            code_changed = (old_code or "") != new_code
            price_changed = abs(float(old_fprice or 0) - new_price) >= 1.0
            ref_changed = (old_ref or "") != new_ref
            yr_changed = new_yr != int(old_yr)

            if not (code_changed or price_changed or ref_changed or yr_changed):
                continue

            if not old_code or old_code == "N/A":
                newly_matched += 1
            elif code_changed:
                changed_code += 1
                if len(samples) < show_samples:
                    samples.append(
                        (
                            desc,
                            new_yr,
                            float(price or 0),
                            old_code or "",
                            old_fmodel or "",
                            float(old_fprice or 0),
                            new_code,
                            new_model,
                            new_price,
                        )
                    )
            else:
                changed_price_only += 1

            updates.append(
                (
                    new_yr,
                    new_price,
                    new_code,
                    new_brand,
                    new_model,
                    new_fyear,
                    new_ref,
                    new_diff,
                    cid,
                )
            )

        history_updated = 0
        if not dry_run and updates:
            cur.executemany(
                """
                UPDATE carros_temp
                SET year = ?,
                    fipe_price = ?,
                    fipe_code = ?,
                    fipe_brand = ?,
                    fipe_model = ?,
                    fipe_year = ?,
                    fipe_ref_period = ?,
                    fipe_diff_pct = ?
                WHERE id = ?
                """,
                updates,
            )

            if update_history:
                # Atualiza snapshots de carros_history cujo fipe_code divergia do novo match do carro
                hist_rows = cur.execute(
                    "SELECT id, carro_id, price, fipe_code, fipe_price FROM carros_history WHERE carro_id != ''"
                ).fetchall()
                hist_updates = []
                for hid, carro_id, hprice, old_hcode, old_hfprice in hist_rows:
                    finfo = fipe_by_carro_id.get(carro_id)
                    if not finfo:
                        continue
                    new_fp, new_fc, new_fb, new_fm, new_fy, new_fr, _ = finfo
                    if (old_hcode or "") != new_fc:
                        hist_updates.append(
                            (
                                new_fp,
                                new_fc,
                                new_fb,
                                new_fm,
                                new_fy,
                                new_fr,
                                compute_diff_pct(hprice, new_fp),
                                hid,
                            )
                        )
                if hist_updates:
                    cur.executemany(
                        """
                        UPDATE carros_history
                        SET fipe_price = ?,
                            fipe_code = ?,
                            fipe_brand = ?,
                            fipe_model = ?,
                            fipe_year = ?,
                            fipe_ref_period = ?,
                            fipe_diff_pct = ?
                        WHERE id = ?
                        """,
                        hist_updates,
                    )
                    history_updated = len(hist_updates)

            conn.commit()
            integrity = cur.execute("PRAGMA integrity_check").fetchone()
            if not integrity or integrity[0] != "ok":
                raise RuntimeError(f"Falha no PRAGMA integrity_check: {integrity}")

        print(
            f"Resumo carros_temp ({'DRY-RUN' if dry_run else 'APLICADO'}): "
            f"codigo FIPE corrigido={changed_code:,} | novos matches={newly_matched:,} | "
            f"preco/ref atualizado={changed_price_only:,} | anos Peugeot 2008 corrigidos={repaired_year_count:,}"
        )
        if not dry_run and update_history:
            print(f"Resumo carros_history: {history_updated:,} snapshots atualizados")

        if samples:
            print("\nExemplos de codigos FIPE corrigidos:")
            for s in samples:
                print(f"  AD:  {s[0][:68]} ({s[1]}) R$ {s[2]:,.0f}")
                print(f"  OLD: {s[3]} | {s[4]:45s} | R$ {s[5]:,.0f}")
                print(f"  NEW: {s[6]} | {s[7]:45s} | R$ {s[8]:,.0f}")

        return {
            "total": len(rows),
            "changed_code": changed_code,
            "newly_matched": newly_matched,
            "changed_price_only": changed_price_only,
            "history_updated": history_updated,
        }
    finally:
        conn.close()


def resolve_compose_volume_name(compose_file: Path, volume_key: str = "pb-dev-data") -> str:
    try:
        res = subprocess.run(
            ["docker", "compose", "-f", str(compose_file), "config", "--format", "json"],
            capture_output=True,
            text=True,
            check=True,
        )
        cfg = json.loads(res.stdout)
        vol_cfg = (cfg.get("volumes") or {}).get(volume_key) or {}
        if isinstance(vol_cfg, dict) and vol_cfg.get("name"):
            return str(vol_cfg["name"])
        if cfg.get("name"):
            return f"{cfg['name']}_{volume_key}"
    except (subprocess.SubprocessError, json.JSONDecodeError, OSError):
        pass
    return f"{compose_file.resolve().parent.name.lower().replace(' ', '_')}_{volume_key}"


def compose_pb_ids(compose_file: Path) -> set[str]:
    try:
        res = subprocess.run(
            ["docker", "compose", "-f", str(compose_file), "ps", "-q", "pocketbase"],
            capture_output=True,
            text=True,
            check=True,
        )
        return {line.strip()[:12] for line in res.stdout.splitlines() if line.strip()}
    except (subprocess.SubprocessError, OSError):
        return set()


def containers_using_volume(volume_name: str) -> List[Tuple[str, str]]:
    res = subprocess.run(
        ["docker", "ps", "--filter", f"volume={volume_name}", "--format", "{{.ID}}\t{{.Names}}"],
        capture_output=True,
        text=True,
        check=True,
    )
    out: List[Tuple[str, str]] = []
    for line in res.stdout.splitlines():
        if line.strip():
            cid, _, cname = line.strip().partition("\t")
            out.append((cid[:12], cname))
    return out


def rematch_docker_volume(
    volume_name: str,
    compose_file: Path,
    catalog: Dict[int, YearCatalogBucket],
    dry_run: bool,
    update_history: bool,
    force: bool,
    helper_image: str = "alpine:3.21",
) -> None:
    attached = containers_using_volume(volume_name)
    own_ids = compose_pb_ids(compose_file)
    stopped: List[Tuple[str, str]] = []

    if attached and not dry_run:
        foreign = [(cid, cname) for cid, cname in attached if cid not in own_ids]
        if foreign and not force:
            names = ", ".join(cname for _, cname in foreign)
            raise RuntimeError(
                f"Volume '{volume_name}' em uso por container(s): {names}. "
                "Pare antes ou passe --force."
            )
        for cid, cname in attached:
            print(f"Parando container {cname} ({cid}) antes de atualizar SQLite...")
            subprocess.run(["docker", "stop", cid], check=True, stdout=subprocess.DEVNULL)
            stopped.append((cid, cname))

    try:
        with tempfile.TemporaryDirectory(prefix="pb_rematch_vol_") as tmpdir:
            local_db = Path(tmpdir) / "data.db"
            # Exporta data.db do volume via tar stdout
            proc_out = subprocess.run(
                [
                    "docker",
                    "run",
                    "--rm",
                    "-v",
                    f"{volume_name}:/pb/pb_data:ro",
                    helper_image,
                    "sh",
                    "-c",
                    "tar -cf - -C /pb/pb_data data.db",
                ],
                capture_output=True,
                check=True,
            )
            with tarfile.open(fileobj=io.BytesIO(proc_out.stdout), mode="r:") as tar:
                tar.extract("data.db", path=tmpdir)

            rematch_sqlite_db(
                db_path=local_db,
                catalog=catalog,
                dry_run=dry_run,
                update_history=update_history,
            )

            if not dry_run:
                print(f"Gravando data.db atualizado de volta no volume '{volume_name}'...")
                buf = io.BytesIO()
                with tarfile.open(fileobj=buf, mode="w:") as tar:
                    tar.add(local_db, arcname="data.db")
                swap = (
                    "set -eu; "
                    "tar -xf - -C /pb/pb_data --transform 's/^data.db$/data.db.rematch/' 2>/dev/null || "
                    "(mkdir -p /pb/pb_data/.rematch_tmp && tar -xf - -C /pb/pb_data/.rematch_tmp && "
                    "mv /pb/pb_data/.rematch_tmp/data.db /pb/pb_data/data.db.rematch && rmdir /pb/pb_data/.rematch_tmp); "
                    "rm -f /pb/pb_data/data.db-shm /pb/pb_data/data.db-wal; "
                    "mv /pb/pb_data/data.db.rematch /pb/pb_data/data.db"
                )
                subprocess.run(
                    [
                        "docker",
                        "run",
                        "--rm",
                        "-i",
                        "-v",
                        f"{volume_name}:/pb/pb_data",
                        helper_image,
                        "sh",
                        "-c",
                        swap,
                    ],
                    input=buf.getvalue(),
                    check=True,
                )
    finally:
        for cid, cname in stopped:
            print(f"Reiniciando container {cname} ({cid})...")
            subprocess.run(["docker", "start", cid], check=True, stdout=subprocess.DEVNULL)


def rematch_seed_zip(
    seed_zip: Path,
    catalog: Dict[int, YearCatalogBucket],
    dry_run: bool,
    update_history: bool,
) -> None:
    if not seed_zip.is_file():
        raise FileNotFoundError(f"Seed zip nao encontrado: {seed_zip}")

    with tempfile.TemporaryDirectory(prefix="pb_rematch_zip_") as tmpdir:
        db_path = Path(tmpdir) / "data.db"
        with zipfile.ZipFile(seed_zip, "r") as zin:
            with zin.open("data.db") as src, open(db_path, "wb") as dst:
                shutil.copyfileobj(src, dst)

        rematch_sqlite_db(
            db_path=db_path,
            catalog=catalog,
            dry_run=dry_run,
            update_history=update_history,
        )

        if dry_run:
            return

        tmp_zip = seed_zip.with_suffix(seed_zip.suffix + ".tmp")
        if tmp_zip.exists():
            tmp_zip.unlink()

        t0 = time.monotonic()
        print(f"Reempacotando {seed_zip.name} com data.db atualizado...")
        try:
            with zipfile.ZipFile(seed_zip, "r") as zin, zipfile.ZipFile(tmp_zip, "w", allowZip64=True) as zout:
                zout.write(db_path, arcname="data.db", compress_type=zipfile.ZIP_DEFLATED, compresslevel=6)
                for info in zin.infolist():
                    if info.filename == "data.db" or info.is_dir():
                        continue
                    out_info = zipfile.ZipInfo(filename=info.filename, date_time=info.date_time)
                    out_info.compress_type = info.compress_type
                    out_info.external_attr = info.external_attr
                    with zin.open(info, "r") as src, zout.open(out_info, "w") as dst:
                        shutil.copyfileobj(src, dst, length=1024 * 256)
        except BaseException:
            if tmp_zip.exists():
                tmp_zip.unlink()
            raise

        os.replace(tmp_zip, seed_zip)
        print(f"Seed zip atualizado em {time.monotonic() - t0:.1f}s: {seed_zip}")


def _pb_request(
    url: str,
    method: str = "GET",
    token: Optional[str] = None,
    body: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    headers = {"Accept": "application/json"}
    data_bytes = None
    if token:
        headers["Authorization"] = token
    if body is not None:
        headers["Content-Type"] = "application/json"
        data_bytes = json.dumps(body).encode("utf-8")

    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def rematch_pb_http(
    pb_url: str,
    email: str,
    password: str,
    catalog: Dict[int, YearCatalogBucket],
    dry_run: bool,
) -> None:
    base = pb_url.rstrip("/")
    token = None
    if email and password:
        for auth_path in (
            "/api/collections/_superusers/auth-with-password",
            "/api/collections/users/auth-with-password",
        ):
            try:
                auth = _pb_request(
                    f"{base}{auth_path}",
                    method="POST",
                    body={"identity": email, "password": password},
                )
                token = auth.get("token")
                if token:
                    break
            except urllib.error.HTTPError:
                continue
        if not token:
            raise RuntimeError("Falha na autenticacao PocketBase com email/senha informados.")
    elif not dry_run:
        raise RuntimeError("Informe --email e --password (ou POCKETBASE_EMAIL/POCKETBASE_PASSWORD) para atualizar via HTTP.")

    page = 1
    per_page = 500
    all_records: List[Dict[str, Any]] = []
    fields = "id,text_description,brand,model,version,year,transmission,fuel,price,fipe_code,fipe_model,fipe_price,fipe_ref_period"

    while True:
        qs = urllib.parse.urlencode({"page": page, "perPage": per_page, "fields": fields, "filter": "year > 0"})
        res = _pb_request(f"{base}/api/collections/carros_temp/records?{qs}", token=token)
        items = res.get("items") or []
        all_records.extend(items)
        if page >= int(res.get("totalPages") or 1):
            break
        page += 1

    print(f"Carregados {len(all_records):,} registros de {base}")
    candidates = [
        {
            "id": rec["id"],
            "title": rec.get("text_description") or "",
            "brand": rec.get("brand") or "",
            "model": rec.get("model") or "",
            "version": rec.get("version") or "",
            "year": repair_peugeot_2008_year(
                rec.get("text_description") or "",
                rec.get("brand") or "",
                int(rec.get("year") or 0),
            ),
            "transmission": rec.get("transmission") or "",
            "fuel": rec.get("fuel") or "",
        }
        for rec in all_records
    ]
    matches = match_listings_against_catalog(candidates, catalog)

    to_patch: List[Tuple[str, Dict[str, Any], Dict[str, Any]]] = []
    for rec, cand in zip(all_records, candidates):
        nm = matches.get(rec["id"])
        if not nm:
            continue
        old_code = rec.get("fipe_code") or ""
        old_price = float(rec.get("fipe_price") or 0)
        new_code = nm["codigo_fipe"]
        new_price = float(nm["valor"])
        if old_code == new_code and abs(old_price - new_price) < 1.0 and int(rec.get("year") or 0) == cand["year"]:
            continue
        payload = {
            "year": cand["year"],
            "fipe_price": new_price,
            "fipe_code": new_code,
            "fipe_brand": nm["nome_marca"],
            "fipe_model": nm["nome_modelo"],
            "fipe_year": int(nm["ano_modelo"]),
            "fipe_ref_period": nm["periodo_referencia"],
            "fipe_diff_pct": compute_diff_pct(rec.get("price"), new_price),
        }
        to_patch.append((rec["id"], rec, payload))

    print(f"Registros a atualizar via HTTP ({'DRY-RUN' if dry_run else 'APLICANDO'}): {len(to_patch):,}")
    for _, rec, payload in to_patch[:10]:
        if (rec.get("fipe_code") or "") != payload["fipe_code"]:
            print(f"  AD:  {(rec.get('text_description') or '')[:68]} ({payload['year']})")
            print(f"  OLD: {rec.get('fipe_code')} | {rec.get('fipe_model')} | R$ {float(rec.get('fipe_price') or 0):,.0f}")
            print(f"  NEW: {payload['fipe_code']} | {payload['fipe_model']} | R$ {payload['fipe_price']:,.0f}")

    if dry_run:
        return

    updated = 0
    for rec_id, _, payload in to_patch:
        _pb_request(
            f"{base}/api/collections/carros_temp/records/{rec_id}",
            method="PATCH",
            token=token,
            body=payload,
        )
        updated += 1
        if updated % 250 == 0:
            print(f"  PATCH: {updated:,}/{len(to_patch):,}...")
    print(f"Atualizacao HTTP concluida: {updated:,} registros atualizados.")


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Reprocessa o match FIPE dos anuncios do PocketBase.")
    target = parser.add_mutually_exclusive_group()
    target.add_argument("--volume", type=str, help="Nome do volume Docker PocketBase (padrao: pb-dev-data do compose).")
    target.add_argument("--db-path", type=Path, help="Caminho para data.db local.")
    target.add_argument("--seed-zip", type=Path, help="Caminho para backup/fipex_dev_seed.zip a atualizar.")
    target.add_argument("--pb-url", type=str, help="URL HTTP de uma instancia PocketBase ativa (ex.: producao).")

    parser.add_argument("--parquet", type=Path, help="Caminho para o arquivo parquet FIPE (padrao: auto-detecta).")
    parser.add_argument("--compose-file", type=Path, default=REPO_ROOT / "docker-compose.dev.yml")
    parser.add_argument("--email", type=str, default=os.environ.get("POCKETBASE_EMAIL", ""))
    parser.add_argument("--password", type=str, default=os.environ.get("POCKETBASE_PASSWORD", ""))
    parser.add_argument("--no-history", action="store_true", help="Nao atualiza snapshots em carros_history (somente carros_temp).")
    parser.add_argument("--dry-run", action="store_true", help="Apenas simula e exibe mudancas sem gravar.")
    parser.add_argument("--force", action="store_true", help="Permite parar/reiniciar container externo no modo --volume.")
    args = parser.parse_args(argv)

    parquet_path = args.parquet or discover_parquet_file()
    if not parquet_path or not parquet_path.is_file():
        parser.error("Arquivo parquet FIPE nao encontrado. Informe via --parquet.")

    catalog = load_fipe_catalog(parquet_path)

    if args.db_path:
        rematch_sqlite_db(args.db_path, catalog, dry_run=args.dry_run, update_history=not args.no_history)
    elif args.seed_zip:
        rematch_seed_zip(args.seed_zip, catalog, dry_run=args.dry_run, update_history=not args.no_history)
    elif args.pb_url:
        rematch_pb_http(args.pb_url, args.email, args.password, catalog, dry_run=args.dry_run)
    else:
        volume_name = args.volume or resolve_compose_volume_name(args.compose_file)
        rematch_docker_volume(
            volume_name=volume_name,
            compose_file=args.compose_file,
            catalog=catalog,
            dry_run=args.dry_run,
            update_history=not args.no_history,
            force=args.force,
        )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nInterrompido pelo usuario.", file=sys.stderr)
        raise SystemExit(130)
    except Exception as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        raise SystemExit(1)
