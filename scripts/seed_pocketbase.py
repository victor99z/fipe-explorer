#!/usr/bin/env python3
"""
FIPEX PocketBase Backup & Dev Seed CLI.

Prepara e restaura backups oficiais do PocketBase para ambientes de
desenvolvimento, filtrando apenas as colecoes do FIPEX (carros) e removendo
colecoes/arquivos de outros projetos compartilhados na mesma instancia.

Exemplos:
  # Inspecionar um backup oficial
  python3 scripts/seed_pocketbase.py inspect

  # Gerar seed limpo (somente FIPEX + imagens de carros) em backup/fipex_dev_seed.zip
  python3 scripts/seed_pocketbase.py prepare

  # Gerar seed leve sem imagens locais (~35 MB)
  python3 scripts/seed_pocketbase.py prepare --no-images -o backup/fipex_dev_seed_no_images.zip

  # Restaurar no volume Docker pb-dev-data do docker-compose.dev.yml
  python3 scripts/seed_pocketbase.py restore

  # Restaurar em um diretorio local pb_data/
  python3 scripts/seed_pocketbase.py restore --target-dir ./pb_data
"""

from __future__ import annotations

import argparse
import io
import json
import os
import posixpath
import shutil
import sqlite3
import subprocess
import sys
import tarfile
import tempfile
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

# Colecoes de dominio do FIPEX preservadas no seed de dev (system=1 sao sempre mantidas).
FIPEX_COLLECTIONS: frozenset[str] = frozenset(
    {
        "users",
        "car_listings",
        "carros_temp",
        "carros_history",
        "user_car_curation",
        "car_alerts",
        "car_alert_notifications",
        "car_crawler_runs",
        "car_crawler_logs",
    }
)

DEFAULT_SEED_FILENAME = "fipex_dev_seed.zip"
ALREADY_COMPRESSED_EXTS = frozenset(
    {".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".mp4", ".webm", ".zip", ".gz", ".br", ".zst"}
)
PROGRESS_STEP = 10_000


@dataclass(frozen=True)
class CollectionInfo:
    id: str
    name: str
    type: str
    system: bool
    rows: int | None


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def git_common_repo_root(start: Path) -> Path | None:
    """Resolve o diretorio do repositorio principal caso estejamos em uma git worktree."""
    try:
        res = subprocess.run(
            ["git", "-C", str(start), "rev-parse", "--git-common-dir"],
            capture_output=True,
            text=True,
            check=True,
        )
        common_dir = Path(res.stdout.strip())
        if not common_dir.is_absolute():
            common_dir = (start / common_dir).resolve()
        else:
            common_dir = common_dir.resolve()
        if common_dir.name == ".git":
            return common_dir.parent
    except (subprocess.SubprocessError, OSError):
        return None
    return None


def candidate_backup_dirs() -> list[Path]:
    root = repo_root()
    dirs = [root / "backup"]
    common_root = git_common_repo_root(root)
    if common_root and common_root != root:
        dirs.append(common_root / "backup")
    return dirs


def discover_backup_zip(prefer_seed: bool) -> Path | None:
    """Encontra automaticamente o backup mais relevante em ./backup ou na worktree principal."""
    dirs = candidate_backup_dirs()

    if prefer_seed:
        for d in dirs:
            seed_path = d / DEFAULT_SEED_FILENAME
            if seed_path.is_file():
                return seed_path

    raw_candidates: list[Path] = []
    other_candidates: list[Path] = []
    for d in dirs:
        if not d.is_dir():
            continue
        for p in d.glob("*.zip"):
            if not p.is_file():
                continue
            if p.name == DEFAULT_SEED_FILENAME:
                other_candidates.append(p)
            elif p.name.startswith("pb_backup_"):
                raw_candidates.append(p)
            else:
                other_candidates.append(p)

    for bucket in (raw_candidates, other_candidates):
        if bucket:
            bucket.sort(key=lambda p: p.stat().st_mtime, reverse=True)
            return bucket[0]

    return None


def safe_zip_path(name: str) -> str | None:
    """Normaliza e valida caminhos internos de um arquivo ZIP contra Zip Slip."""
    normalized = posixpath.normpath(name.replace("\\", "/"))
    if normalized in ("", ".") or normalized.startswith("/") or normalized.startswith("../") or "/../" in normalized:
        return None
    return normalized


def format_mb(num_bytes: int) -> str:
    return f"{num_bytes / (1024 * 1024):.2f} MB"


def quote_ident(ident: str) -> str:
    return '"' + ident.replace('"', '""') + '"'


def read_collections(conn: sqlite3.Connection, count_rows: bool = True) -> list[CollectionInfo]:
    cur = conn.cursor()
    rows = cur.execute("SELECT id, name, type, system FROM _collections ORDER BY system, name").fetchall()
    result: list[CollectionInfo] = []
    for cid, name, ctype, system in rows:
        cnt: int | None = None
        if count_rows:
            try:
                cnt = int(cur.execute(f"SELECT COUNT(*) FROM {quote_ident(name)}").fetchone()[0])
            except sqlite3.Error:
                cnt = None
        result.append(CollectionInfo(id=cid, name=name, type=ctype, system=bool(system), rows=cnt))
    return result


def inspect_zip(zip_path: Path, keep_names: set[str]) -> None:
    if not zip_path.is_file():
        raise FileNotFoundError(f"Backup nao encontrado: {zip_path}")

    print(f"Backup: {zip_path} ({format_mb(zip_path.stat().st_size)})")

    with zipfile.ZipFile(zip_path, "r") as zf:
        infos = zf.infolist()
        if "data.db" not in zf.namelist():
            raise ValueError(f"Arquivo invalido (sem data.db na raiz): {zip_path}")

        storage_counts: dict[str, int] = {}
        storage_bytes: dict[str, int] = {}
        root_files: dict[str, int] = {}

        for info in infos:
            if info.is_dir():
                continue
            rel = safe_zip_path(info.filename)
            if not rel:
                continue
            parts = rel.split("/")
            if parts[0] == "storage" and len(parts) >= 2:
                col_id = parts[1]
                storage_counts[col_id] = storage_counts.get(col_id, 0) + 1
                storage_bytes[col_id] = storage_bytes.get(col_id, 0) + info.file_size
            elif len(parts) == 1:
                root_files[rel] = info.file_size

        with tempfile.TemporaryDirectory(prefix="pb_inspect_") as tmpdir:
            db_path = Path(tmpdir) / "data.db"
            with zf.open("data.db") as src, open(db_path, "wb") as dst:
                shutil.copyfileobj(src, dst)

            conn = sqlite3.connect(db_path)
            try:
                cols = read_collections(conn, count_rows=True)
            finally:
                conn.close()

    print("\nArquivos raiz:")
    for fname, sz in sorted(root_files.items()):
        print(f"  - {fname:20s} {format_mb(sz):>10s}")

    kept = [c for c in cols if c.system or c.name in keep_names]
    dropped = [c for c in cols if not c.system and c.name not in keep_names]

    print("\nColecoes FIPEX + sistema (preservadas):")
    for c in kept:
        sc = storage_counts.get(c.id, 0)
        sb = storage_bytes.get(c.id, 0)
        storage_note = f" | storage: {sc:,} arq ({format_mb(sb)})" if sc else ""
        tag = "sys" if c.system else "fipex"
        rows_str = f"{c.rows:,}" if c.rows is not None else "?"
        print(f"  [{tag:5s}] {c.name:32s} ({c.type:4s}) rows={rows_str:>8s}{storage_note}")

    if dropped:
        print("\nColecoes fora do FIPEX (removidas no prepare/restore):")
        for c in dropped:
            sc = storage_counts.get(c.id, 0)
            sb = storage_bytes.get(c.id, 0)
            storage_note = f" | storage: {sc:,} arq ({format_mb(sb)})" if sc else ""
            rows_str = f"{c.rows:,}" if c.rows is not None else "?"
            print(f"  [drop ] {c.name:32s} ({c.type:4s}) rows={rows_str:>8s}{storage_note}")
    else:
        print("\nNenhuma colecao fora do FIPEX encontrada (backup ja esta limpo).")


def sanitize_dev_settings(conn: sqlite3.Connection) -> list[str]:
    """Sanitiza configuracoes sensiveis/de producao na tabela _params para uso local em dev."""
    cur = conn.cursor()
    row = cur.execute("SELECT value FROM _params WHERE id = 'settings'").fetchone()
    if not row or not row[0]:
        return []

    settings = json.loads(row[0])
    changes: list[str] = []

    meta = settings.get("meta")
    if isinstance(meta, dict):
        app_url = str(meta.get("appURL") or "")
        if app_url and not (
            app_url.startswith("http://localhost")
            or app_url.startswith("http://127.0.0.1")
        ):
            meta["appURL"] = "http://localhost:8090"
            changes.append("meta.appURL -> http://localhost:8090")
        if meta.get("appName") != "fipex-dev":
            meta["appName"] = "fipex-dev"
            changes.append("meta.appName -> fipex-dev")

    smtp = settings.get("smtp")
    if isinstance(smtp, dict):
        if smtp.get("enabled") or smtp.get("password") or smtp.get("username"):
            smtp["enabled"] = False
            smtp["username"] = ""
            smtp["password"] = ""
            changes.append("smtp desabilitado e credenciais limpas")

    s3 = settings.get("s3")
    if isinstance(s3, dict):
        if s3.get("enabled") or s3.get("secret") or s3.get("accessKey"):
            s3["enabled"] = False
            s3["accessKey"] = ""
            s3["secret"] = ""
            changes.append("s3 desabilitado e credenciais limpas")

    backups = settings.get("backups")
    if isinstance(backups, dict):
        if backups.get("cron"):
            backups["cron"] = ""
            changes.append("backups.cron limpo")
        bs3 = backups.get("s3")
        if isinstance(bs3, dict) and (bs3.get("enabled") or bs3.get("secret") or bs3.get("accessKey")):
            bs3["enabled"] = False
            bs3["accessKey"] = ""
            bs3["secret"] = ""
            changes.append("backups.s3 desabilitado e credenciais limpas")

    rate_limits = settings.get("rateLimits")
    if isinstance(rate_limits, dict) and rate_limits.get("enabled"):
        rate_limits["enabled"] = False
        changes.append("rateLimits desabilitado para dev")

    if changes:
        cur.execute(
            "UPDATE _params SET value = ?, updated = strftime('%Y-%m-%d %H:%M:%fZ', 'now') WHERE id = 'settings'",
            (json.dumps(settings, separators=(",", ":")),),
        )
    return changes


def prune_sqlite_db(
    db_path: Path,
    keep_names: set[str],
    full: bool,
    sanitize_settings: bool,
) -> tuple[set[str], list[CollectionInfo], list[CollectionInfo], list[str]]:
    """
    Remove colecoes nao-FIPEX do data.db, sanitiza settings de dev e executa VACUUM.

    Retorna: (kept_collection_ids, kept_collections, dropped_collections, setting_changes)
    """
    conn = sqlite3.connect(db_path)
    try:
        cols = read_collections(conn, count_rows=False)
        kept: list[CollectionInfo] = []
        dropped: list[CollectionInfo] = []

        for c in cols:
            if full or c.system or c.name in keep_names:
                kept.append(c)
            else:
                dropped.append(c)

        cur = conn.cursor()
        # Views primeiro para nao quebrar dependencias ao remover tabelas base.
        for c in [d for d in dropped if d.type == "view"] + [d for d in dropped if d.type != "view"]:
            if c.type == "view":
                cur.execute(f"DROP VIEW IF EXISTS {quote_ident(c.name)}")
            else:
                cur.execute(f"DROP TABLE IF EXISTS {quote_ident(c.name)}")
            cur.execute("DELETE FROM _collections WHERE id = ?", (c.id,))

        setting_changes: list[str] = []
        if sanitize_settings:
            setting_changes = sanitize_dev_settings(conn)

        conn.commit()

        if dropped or setting_changes:
            cur.execute("VACUUM")

        integrity = cur.execute("PRAGMA integrity_check").fetchone()
        if not integrity or integrity[0] != "ok":
            raise RuntimeError(f"Falha no PRAGMA integrity_check: {integrity}")

        return {c.id for c in kept}, kept, dropped, setting_changes
    finally:
        conn.close()


def iter_kept_storage_infos(
    zf: zipfile.ZipFile,
    kept_collection_ids: set[str],
    include_images: bool,
) -> Iterable[tuple[zipfile.ZipInfo, str]]:
    if not include_images:
        return
    for info in zf.infolist():
        if info.is_dir():
            continue
        rel = safe_zip_path(info.filename)
        if not rel or not rel.startswith("storage/"):
            continue
        parts = rel.split("/")
        if len(parts) >= 3 and parts[1] in kept_collection_ids:
            yield info, rel


def prepare_seed_zip(
    input_zip: Path,
    output_zip: Path,
    keep_names: set[str],
    full: bool = False,
    include_images: bool = True,
    include_auxiliary: bool = False,
    sanitize_settings: bool = True,
) -> Path:
    if not input_zip.is_file():
        raise FileNotFoundError(f"Backup de entrada nao encontrado: {input_zip}")

    t0 = time.monotonic()
    output_zip.parent.mkdir(parents=True, exist_ok=True)
    tmp_output = output_zip.with_suffix(output_zip.suffix + ".tmp")
    if tmp_output.exists():
        tmp_output.unlink()

    print(f"Lendo backup: {input_zip} ({format_mb(input_zip.stat().st_size)})")

    with zipfile.ZipFile(input_zip, "r") as zin:
        names_set = set(zin.namelist())
        if "data.db" not in names_set:
            raise ValueError(f"Backup invalido (sem data.db na raiz): {input_zip}")

        with tempfile.TemporaryDirectory(prefix="pb_seed_prepare_") as tmpdir:
            db_path = Path(tmpdir) / "data.db"
            with zin.open("data.db") as src, open(db_path, "wb") as dst:
                shutil.copyfileobj(src, dst)
            orig_db_size = db_path.stat().st_size

            kept_ids, kept_cols, dropped_cols, setting_changes = prune_sqlite_db(
                db_path=db_path,
                keep_names=keep_names,
                full=full,
                sanitize_settings=sanitize_settings,
            )
            pruned_db_size = db_path.stat().st_size

            print(
                f"data.db: {format_mb(orig_db_size)} -> {format_mb(pruned_db_size)} "
                f"(mantidas: {len(kept_cols)}, removidas: {len(dropped_cols)})"
            )
            if dropped_cols:
                print("Colecoes removidas: " + ", ".join(c.name for c in dropped_cols))
            if setting_changes:
                print("Settings dev sanitizados: " + "; ".join(setting_changes))

            try:
                with zipfile.ZipFile(tmp_output, "w", allowZip64=True) as zout:
                    print("Empacotando data.db (deflated)...")
                    zout.write(db_path, arcname="data.db", compress_type=zipfile.ZIP_DEFLATED, compresslevel=6)

                    for optional_root in ("types.d.ts", "auxiliary.db"):
                        if optional_root == "auxiliary.db" and not include_auxiliary:
                            continue
                        if optional_root in names_set:
                            with zin.open(optional_root) as src:
                                info_out = zipfile.ZipInfo(optional_root)
                                info_out.compress_type = zipfile.ZIP_DEFLATED
                                with zout.open(info_out, "w") as dst:
                                    shutil.copyfileobj(src, dst)

                    if include_images:
                        copied_files = 0
                        copied_bytes = 0
                        for info, rel in iter_kept_storage_infos(zin, kept_ids, include_images=True):
                            ext = posixpath.splitext(rel)[1].lower()
                            compress_type = (
                                zipfile.ZIP_STORED if ext in ALREADY_COMPRESSED_EXTS else zipfile.ZIP_DEFLATED
                            )
                            out_info = zipfile.ZipInfo(filename=rel, date_time=info.date_time)
                            out_info.compress_type = compress_type
                            out_info.external_attr = info.external_attr
                            with zin.open(info, "r") as src, zout.open(out_info, "w") as dst:
                                shutil.copyfileobj(src, dst, length=1024 * 256)
                            copied_files += 1
                            copied_bytes += info.file_size
                            if copied_files % PROGRESS_STEP == 0:
                                print(f"  storage: {copied_files:,} arquivos ({format_mb(copied_bytes)})...")
                        print(f"Storage copiado: {copied_files:,} arquivos ({format_mb(copied_bytes)})")
                    else:
                        print("Storage ignorado (--no-images).")
            except BaseException:
                if tmp_output.exists():
                    tmp_output.unlink()
                raise

    os.replace(tmp_output, output_zip)
    elapsed = time.monotonic() - t0
    print(f"Seed pronto: {output_zip} ({format_mb(output_zip.stat().st_size)}) em {elapsed:.1f}s")
    return output_zip


def restore_to_directory(
    input_zip: Path,
    target_dir: Path,
    keep_names: set[str],
    full: bool,
    include_images: bool,
    include_auxiliary: bool,
    sanitize_settings: bool,
    force: bool,
) -> None:
    if (target_dir / "data.db").exists() and not force:
        raise FileExistsError(
            f"{target_dir / 'data.db'} ja existe. Use --force para sobrescrever."
        )

    t0 = time.monotonic()
    target_dir.mkdir(parents=True, exist_ok=True)
    seed_tmp = target_dir / ".seed_tmp"
    if seed_tmp.exists():
        shutil.rmtree(seed_tmp)
    seed_tmp.mkdir(parents=True, exist_ok=True)

    try:
        with zipfile.ZipFile(input_zip, "r") as zin:
            names_set = set(zin.namelist())
            if "data.db" not in names_set:
                raise ValueError(f"Backup invalido (sem data.db na raiz): {input_zip}")

            db_path = seed_tmp / "data.db"
            with zin.open("data.db") as src, open(db_path, "wb") as dst:
                shutil.copyfileobj(src, dst)

            kept_ids, kept_cols, dropped_cols, setting_changes = prune_sqlite_db(
                db_path=db_path,
                keep_names=keep_names,
                full=full,
                sanitize_settings=sanitize_settings,
            )
            print(
                f"data.db pronto ({format_mb(db_path.stat().st_size)}; "
                f"mantidas: {len(kept_cols)}, removidas: {len(dropped_cols)})"
            )
            if setting_changes:
                print("Settings dev sanitizados: " + "; ".join(setting_changes))

            for optional_root in ("types.d.ts", "auxiliary.db"):
                if optional_root == "auxiliary.db" and not include_auxiliary:
                    continue
                if optional_root in names_set:
                    with zin.open(optional_root) as src, open(seed_tmp / optional_root, "wb") as dst:
                        shutil.copyfileobj(src, dst)

            copied_files = 0
            copied_bytes = 0
            for info, rel in iter_kept_storage_infos(zin, kept_ids, include_images=include_images):
                dest = seed_tmp / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                with zin.open(info, "r") as src, open(dest, "wb") as dst:
                    shutil.copyfileobj(src, dst, length=1024 * 256)
                copied_files += 1
                copied_bytes += info.file_size
                if copied_files % PROGRESS_STEP == 0:
                    print(f"  storage: {copied_files:,} arquivos ({format_mb(copied_bytes)})...")

        # Remove arquivos antigos do destino e faz swap atomico (data.db por ultimo).
        for old_name in (
            "data.db",
            "data.db-shm",
            "data.db-wal",
            "auxiliary.db",
            "auxiliary.db-shm",
            "auxiliary.db-wal",
            "storage",
            "types.d.ts",
        ):
            old_path = target_dir / old_name
            if old_path.is_dir():
                shutil.rmtree(old_path)
            elif old_path.exists():
                old_path.unlink()

        for item in ("storage", "types.d.ts", "auxiliary.db", "data.db"):
            src_item = seed_tmp / item
            if src_item.exists():
                os.replace(src_item, target_dir / item)
    finally:
        if seed_tmp.exists():
            shutil.rmtree(seed_tmp, ignore_errors=True)

    elapsed = time.monotonic() - t0
    print(
        f"Restauracao concluida em {target_dir} "
        f"({copied_files:,} arquivos de storage, {format_mb(copied_bytes)}) em {elapsed:.1f}s."
    )


def resolve_compose_volume_name(compose_file: Path, volume_key: str = "pb-dev-data") -> str:
    try:
        res = subprocess.run(
            ["docker", "compose", "-f", str(compose_file), "config", "--format", "json"],
            capture_output=True,
            text=True,
            check=True,
        )
        cfg = json.loads(res.stdout)
        volumes = cfg.get("volumes") or {}
        vol_cfg = volumes.get(volume_key) or {}
        if isinstance(vol_cfg, dict) and vol_cfg.get("name"):
            return str(vol_cfg["name"])
        project = cfg.get("name")
        if project:
            return f"{project}_{volume_key}"
    except (subprocess.SubprocessError, json.JSONDecodeError, OSError):
        pass
    project_fallback = compose_file.resolve().parent.name.lower().replace(" ", "_")
    return f"{project_fallback}_{volume_key}"


def compose_pocketbase_container_ids(compose_file: Path) -> set[str]:
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


def running_containers_using_volume(volume_name: str) -> list[tuple[str, str]]:
    res = subprocess.run(
        ["docker", "ps", "--filter", f"volume={volume_name}", "--format", "{{.ID}}\t{{.Names}}"],
        capture_output=True,
        text=True,
        check=True,
    )
    containers: list[tuple[str, str]] = []
    for line in res.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        cid, _, cname = line.partition("\t")
        containers.append((cid[:12], cname))
    return containers


def restore_to_docker_volume(
    input_zip: Path,
    volume_name: str,
    compose_file: Path,
    keep_names: set[str],
    full: bool,
    include_images: bool,
    include_auxiliary: bool,
    sanitize_settings: bool,
    force: bool,
    helper_image: str = "alpine:3.21",
) -> None:
    t0 = time.monotonic()
    attached = running_containers_using_volume(volume_name)
    own_pb_ids = compose_pocketbase_container_ids(compose_file)

    stopped_containers: list[tuple[str, str]] = []
    if attached:
        foreign = [(cid, cname) for cid, cname in attached if cid not in own_pb_ids]
        if foreign and not force:
            names = ", ".join(cname for _, cname in foreign)
            raise RuntimeError(
                f"O volume '{volume_name}' esta em uso por container(s) ativo(s): {names}. "
                "Pare o container antes ou passe --force para parar e reiniciar automaticamente."
            )
        for cid, cname in attached:
            print(f"Parando container {cname} ({cid}) antes de restaurar SQLite...")
            subprocess.run(["docker", "stop", cid], check=True, stdout=subprocess.DEVNULL)
            stopped_containers.append((cid, cname))

    try:
        subprocess.run(["docker", "volume", "create", volume_name], check=True, stdout=subprocess.DEVNULL)

        swap_script = (
            "set -eu; "
            "rm -rf /pb/pb_data/.seed_tmp; "
            "mkdir -p /pb/pb_data/.seed_tmp; "
            "tar -xf - -C /pb/pb_data/.seed_tmp; "
            "test -f /pb/pb_data/.seed_tmp/data.db; "
            "rm -rf /pb/pb_data/data.db /pb/pb_data/data.db-shm /pb/pb_data/data.db-wal "
            "/pb/pb_data/auxiliary.db /pb/pb_data/auxiliary.db-shm /pb/pb_data/auxiliary.db-wal "
            "/pb/pb_data/storage /pb/pb_data/types.d.ts; "
            "for item in storage types.d.ts auxiliary.db; do "
            "  if [ -e \"/pb/pb_data/.seed_tmp/${item}\" ]; then "
            "    mv \"/pb/pb_data/.seed_tmp/${item}\" \"/pb/pb_data/${item}\"; "
            "  fi; "
            "done; "
            "mv /pb/pb_data/.seed_tmp/data.db /pb/pb_data/data.db; "
            "rm -rf /pb/pb_data/.seed_tmp"
        )

        with zipfile.ZipFile(input_zip, "r") as zin:
            names_set = set(zin.namelist())
            if "data.db" not in names_set:
                raise ValueError(f"Backup invalido (sem data.db na raiz): {input_zip}")

            with tempfile.TemporaryDirectory(prefix="pb_vol_restore_") as tmpdir:
                db_path = Path(tmpdir) / "data.db"
                with zin.open("data.db") as src, open(db_path, "wb") as dst:
                    shutil.copyfileobj(src, dst)

                kept_ids, kept_cols, dropped_cols, setting_changes = prune_sqlite_db(
                    db_path=db_path,
                    keep_names=keep_names,
                    full=full,
                    sanitize_settings=sanitize_settings,
                )
                print(
                    f"data.db pronto ({format_mb(db_path.stat().st_size)}; "
                    f"mantidas: {len(kept_cols)}, removidas: {len(dropped_cols)})"
                )
                if setting_changes:
                    print("Settings dev sanitizados: " + "; ".join(setting_changes))

                print(f"Enviando dados para o volume Docker '{volume_name}'...")
                proc = subprocess.Popen(
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
                        swap_script,
                    ],
                    stdin=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                )
                assert proc.stdin is not None and proc.stderr is not None

                copied_files = 0
                copied_bytes = 0
                try:
                    with tarfile.open(fileobj=proc.stdin, mode="w|") as tar:
                        tar.add(db_path, arcname="data.db")

                        for optional_root in ("types.d.ts", "auxiliary.db"):
                            if optional_root == "auxiliary.db" and not include_auxiliary:
                                continue
                            if optional_root in names_set:
                                data = zin.read(optional_root)
                                ti = tarfile.TarInfo(name=optional_root)
                                ti.size = len(data)
                                ti.mode = 0o644
                                tar.addfile(ti, io.BytesIO(data))

                        for info, rel in iter_kept_storage_infos(zin, kept_ids, include_images=include_images):
                            ti = tarfile.TarInfo(name=rel)
                            ti.size = info.file_size
                            ti.mode = 0o644
                            with zin.open(info, "r") as src:
                                tar.addfile(ti, src)
                            copied_files += 1
                            copied_bytes += info.file_size
                            if copied_files % PROGRESS_STEP == 0:
                                print(f"  storage: {copied_files:,} arquivos ({format_mb(copied_bytes)})...")
                except BrokenPipeError:
                    pass
                finally:
                    try:
                        proc.stdin.close()
                    except OSError:
                        pass

                stderr_out = proc.stderr.read().decode("utf-8", errors="replace").strip()
                rc = proc.wait()
                if rc != 0:
                    raise RuntimeError(
                        f"Falha ao restaurar volume Docker '{volume_name}' (exit {rc}): {stderr_out}"
                    )

        elapsed = time.monotonic() - t0
        print(
            f"Volume '{volume_name}' restaurado com sucesso "
            f"({copied_files:,} arquivos de storage, {format_mb(copied_bytes)}) em {elapsed:.1f}s."
        )
    finally:
        for cid, cname in stopped_containers:
            print(f"Reiniciando container {cname} ({cid})...")
            subprocess.run(["docker", "start", cid], check=True, stdout=subprocess.DEVNULL)


def add_filter_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--keep-collection",
        action="append",
        default=[],
        help="Colecao adicional a preservar alem das colecoes padrao do FIPEX (pode repetir).",
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="Preserva todas as colecoes do backup sem filtrar projetos externos.",
    )
    parser.add_argument(
        "--no-images",
        action="store_true",
        help="Nao inclui arquivos de storage/ (imagens locais) no seed/restore.",
    )
    parser.add_argument(
        "--include-auxiliary",
        action="store_true",
        help="Inclui auxiliary.db (logs antigos). Por padrao o PocketBase cria um limpo.",
    )
    parser.add_argument(
        "--no-sanitize-settings",
        action="store_true",
        help="Nao altera configuracoes em _params (SMTP/S3/appURL/rateLimits).",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Prepara e restaura backups do PocketBase para desenvolvimento do FIPEX."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_inspect = sub.add_parser("inspect", help="Inspeciona colecoes e storage de um backup .zip.")
    p_inspect.add_argument("input_zip", nargs="?", type=Path, help="Caminho do backup .zip (padrao: auto-detecta em backup/).")
    p_inspect.add_argument("--keep-collection", action="append", default=[])

    p_prepare = sub.add_parser("prepare", help="Gera um seed .zip limpo (somente FIPEX) pronto para auto-seed/restore.")
    p_prepare.add_argument("input_zip", nargs="?", type=Path, help="Caminho do backup oficial .zip (padrao: auto-detecta).")
    p_prepare.add_argument(
        "-o",
        "--output",
        type=Path,
        default=repo_root() / "backup" / DEFAULT_SEED_FILENAME,
        help="Caminho de saida do seed .zip (padrao: ./backup/fipex_dev_seed.zip).",
    )
    add_filter_args(p_prepare)

    p_restore = sub.add_parser("restore", help="Restaura o backup/seed no volume Docker de dev ou diretorio local.")
    p_restore.add_argument("input_zip", nargs="?", type=Path, help="Caminho do backup/seed .zip (padrao: auto-detecta).")
    target_group = p_restore.add_mutually_exclusive_group()
    target_group.add_argument(
        "--volume",
        type=str,
        help="Nome do volume Docker de destino (padrao: volume pb-dev-data do compose).",
    )
    target_group.add_argument(
        "--target-dir",
        type=Path,
        help="Diretorio local pb_data de destino (alternativa ao volume Docker).",
    )
    p_restore.add_argument(
        "--compose-file",
        type=Path,
        default=repo_root() / "docker-compose.dev.yml",
        help="Arquivo Docker Compose usado para detectar o volume padrao (padrao: docker-compose.dev.yml).",
    )
    p_restore.add_argument(
        "--force",
        action="store_true",
        help="Permite sobrescrever diretorio existente ou parar/reiniciar container externo usando o volume.",
    )
    add_filter_args(p_restore)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    keep_names = set(FIPEX_COLLECTIONS) | set(getattr(args, "keep_collection", []) or [])

    if args.command == "inspect":
        zip_path = args.input_zip or discover_backup_zip(prefer_seed=False)
        if not zip_path:
            parser.error("Nenhum backup .zip encontrado em backup/. Informe o caminho explicitamente.")
        inspect_zip(zip_path, keep_names)
        return 0

    if args.command == "prepare":
        zip_path = args.input_zip or discover_backup_zip(prefer_seed=False)
        if not zip_path:
            parser.error("Nenhum backup .zip encontrado em backup/. Informe o caminho explicitamente.")
        prepare_seed_zip(
            input_zip=zip_path,
            output_zip=args.output,
            keep_names=keep_names,
            full=args.full,
            include_images=not args.no_images,
            include_auxiliary=args.include_auxiliary,
            sanitize_settings=not args.no_sanitize_settings,
        )
        return 0

    if args.command == "restore":
        zip_path = args.input_zip or discover_backup_zip(prefer_seed=True)
        if not zip_path:
            parser.error("Nenhum backup/seed .zip encontrado em backup/. Informe o caminho explicitamente.")
        if args.target_dir:
            restore_to_directory(
                input_zip=zip_path,
                target_dir=args.target_dir,
                keep_names=keep_names,
                full=args.full,
                include_images=not args.no_images,
                include_auxiliary=args.include_auxiliary,
                sanitize_settings=not args.no_sanitize_settings,
                force=args.force,
            )
        else:
            volume_name = args.volume or resolve_compose_volume_name(args.compose_file)
            restore_to_docker_volume(
                input_zip=zip_path,
                volume_name=volume_name,
                compose_file=args.compose_file,
                keep_names=keep_names,
                full=args.full,
                include_images=not args.no_images,
                include_auxiliary=args.include_auxiliary,
                sanitize_settings=not args.no_sanitize_settings,
                force=args.force,
            )
        return 0

    return 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nInterrompido pelo usuario.", file=sys.stderr)
        raise SystemExit(130)
    except Exception as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        raise SystemExit(1)
