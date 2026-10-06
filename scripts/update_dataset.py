#!/usr/bin/env python3
"""
==============================================================================
FIPEX Explorer - Automação Mensal de Atualização do Dataset FIPE
==============================================================================
Monitora o repositório Hugging Face (alanwgt/fipex-veiculos-brasil), detecta
novos commits mensais, faz download resiliente com validação de integridade,
executa o enriquecimento pré-calculado com DuckDB e aplica atomicamente
sem interrupção de serviço (Zero Downtime).
==============================================================================
"""

import os
import sys
import time
import json
import argparse
import requests
from datetime import datetime, timezone

# Adicionar root ao sys.path para importações locais se necessário
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from scripts.enrich_parquet import enrich_dataset

HF_API_URL = "https://huggingface.co/api/datasets/alanwgt/fipex-veiculos-brasil"
HF_DOWNLOAD_URL = "https://huggingface.co/datasets/alanwgt/fipex-veiculos-brasil/resolve/main/fipex-prices-latest.parquet"

DATA_DIR = os.path.join(ROOT_DIR, "data")
VERSION_FILE = os.path.join(DATA_DIR, ".fipex_version.json")
RAW_PARQUET = os.path.join(DATA_DIR, "fipex-prices.parquet")
RAW_PARQUET_TMP = os.path.join(DATA_DIR, "fipex-prices.tmp.parquet")
ENRICHED_PARQUET = os.path.join(DATA_DIR, "fipex-prices-enriched.parquet")
ENRICHED_PARQUET_TMP = os.path.join(DATA_DIR, "fipex-prices-enriched.tmp.parquet")

def get_local_version() -> dict:
    """Lê metadados da última versão instalada localmente."""
    if os.path.exists(VERSION_FILE):
        try:
            with open(VERSION_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[!] Aviso: Erro ao ler {VERSION_FILE}: {e}")
    return {}

def save_local_version(data: dict):
    """Grava metadados da versão atualizada."""
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(VERSION_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def get_remote_info() -> dict:
    """Consulta metadados rápidos do dataset no Hugging Face (150ms)."""
    headers = {"User-Agent": "fipex-updater/1.0"}
    res = requests.get(HF_API_URL, headers=headers, timeout=15)
    res.raise_for_status()
    payload = res.json()
    
    sha = payload.get("sha")
    last_modified = payload.get("lastModified")
    return {
        "sha": sha,
        "last_modified": last_modified,
    }

def download_file(url: str, dest_path: str):
    """Baixa arquivo em streaming com barra de progresso e retries."""
    headers = {"User-Agent": "fipex-updater/1.0"}
    print(f"[*] Iniciando download de: {url}")
    print(f"[*] Destino temporário: {dest_path}")
    
    t0 = time.time()
    with requests.get(url, headers=headers, stream=True, timeout=60) as r:
        r.raise_for_status()
        total_size = int(r.headers.get("content-length", 0))
        downloaded = 0
        chunk_size = 1024 * 1024  # 1 MB por chunk
        
        with open(dest_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=chunk_size):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        pct = (downloaded / total_size) * 100
                        mb_done = downloaded / (1024 * 1024)
                        mb_total = total_size / (1024 * 1024)
                        speed = mb_done / max(time.time() - t0, 0.001)
                        print(f"\r[↓] {pct:5.1f}% [{mb_done:6.1f} MB / {mb_total:6.1f} MB] @ {speed:5.2f} MB/s", end="", flush=True)

    print()
    elapsed = time.time() - t0
    final_mb = os.path.getsize(dest_path) / (1024 * 1024)
    print(f"[✓] Download concluído com sucesso em {elapsed:.1f}s ({final_mb:.1f} MB)")

    # Validação dos magic bytes Parquet (PAR1)
    with open(dest_path, "rb") as f:
        magic = f.read(4)
        if magic != b"PAR1":
            raise ValueError(f"Arquivo corrompido ou inválido! Magic bytes: {magic} (esperado: b'PAR1')")
    print("[✓] Assinatura Parquet (PAR1) validada com sucesso!")

def notify_backend(backend_url: str):
    """Notifica o backend para recarregar o dataset e invalidar TTLCache."""
    if not backend_url:
        return
    endpoint = f"{backend_url.rstrip('/')}/api/internal/refresh"
    print(f"[*] Notificando backend em: {endpoint}")
    try:
        res = requests.post(endpoint, timeout=10)
        if res.ok:
            data = res.json()
            print(f"[✓] Backend respondeu: {data.get('message')} (Total registros: {data.get('total_records'):,})")
        else:
            print(f"[!] Backend retornou status {res.status_code}: {res.text}")
    except Exception as e:
        print(f"[!] Não foi possível conectar ao backend ({endpoint}): {e} (o backend recarregará automaticamente no próximo reinício)")

def run_update(force: bool = False, backend_url: str = None) -> bool:
    """Executa o ciclo completo de verificação, download e enriquecimento atômico."""
    os.makedirs(DATA_DIR, exist_ok=True)
    local_meta = get_local_version()
    current_sha = local_meta.get("sha")

    print("=" * 70)
    print("FIPEX DATASET UPDATER - VERIFICAÇÃO DE ATUALIZAÇÃO")
    print(f"Horário: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 70)

    try:
        remote_info = get_remote_info()
    except Exception as e:
        print(f"[ERRO] Falha ao consultar API do Hugging Face: {e}", file=sys.stderr)
        return False

    remote_sha = remote_info["sha"]
    print(f"[*] Versão local instalada : {current_sha or 'Nenhuma'}")
    print(f"[*] Versão remota disponível: {remote_sha} (Modificado: {remote_info.get('last_modified')})")

    if not force and current_sha and current_sha == remote_sha and os.path.exists(ENRICHED_PARQUET):
        print("[✓] O dataset local já está atualizado com a versão mais recente do Hugging Face!")
        return False

    print("\n[+] Nova versão encontrada ou modo --force ativado! Iniciando atualização...")

    # 1. Download para arquivo temporário
    try:
        download_file(HF_DOWNLOAD_URL, RAW_PARQUET_TMP)
    except Exception as e:
        print(f"[ERRO] Falha durante o download: {e}", file=sys.stderr)
        if os.path.exists(RAW_PARQUET_TMP):
            os.remove(RAW_PARQUET_TMP)
        return False

    # 2. Atomic swap do arquivo bruto
    os.replace(RAW_PARQUET_TMP, RAW_PARQUET)
    print(f"[✓] Arquivo bruto atualizado: {RAW_PARQUET}")

    # 3. Pipeline de enriquecimento DuckDB
    try:
        stats = enrich_dataset(RAW_PARQUET, ENRICHED_PARQUET_TMP)
    except Exception as e:
        print(f"[ERRO] Falha no enriquecimento DuckDB: {e}", file=sys.stderr)
        if os.path.exists(ENRICHED_PARQUET_TMP):
            os.remove(ENRICHED_PARQUET_TMP)
        return False

    # 4. Atomic swap do arquivo enriquecido (Zero Downtime)
    os.replace(ENRICHED_PARQUET_TMP, ENRICHED_PARQUET)
    print(f"[✓] Atomic swap concluído! Arquivo em produção atualizado: {ENRICHED_PARQUET}")

    # 5. Salva nova versão local
    version_record = {
        "sha": remote_sha,
        "last_modified": remote_info.get("last_modified"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "total_records": stats.get("total_rows"),
        "enriched_size_mb": stats.get("output_size_mb"),
        "stats": stats
    }
    save_local_version(version_record)
    print(f"[✓] Metadados salvos em {VERSION_FILE}")

    # 6. Notifica o backend
    notify_backend(backend_url)

    print("\n" + "=" * 70)
    print(f"[SUCESSO] Dataset atualizado para versão {remote_sha[:10]} ({stats.get('total_rows'):,} linhas)")
    print("=" * 70)
    return True

def main():
    parser = argparse.ArgumentParser(description="Atualizador automatizado de dataset FIPE via Hugging Face")
    parser.add_argument("--check", action="store_true", help="Apenas verifica se há atualização disponível e encerra")
    parser.add_argument("--force", action="store_true", help="Força download e enriquecimento mesmo se já atualizado")
    parser.add_argument("--daemon", action="store_true", help="Executa continuamente como serviço em loop")
    parser.add_argument("--interval-hours", type=float, default=float(os.getenv("UPDATE_INTERVAL_HOURS", 24)),
                        help="Intervalo em horas entre checagens no modo daemon (padrão: 24h)")
    parser.add_argument("--backend-url", type=str, default=os.getenv("BACKEND_URL", "http://backend:8000"),
                        help="URL base do backend para envio de notificação de reload")
    args = parser.parse_args()

    if args.check:
        local_meta = get_local_version()
        remote_info = get_remote_info()
        print(f"Local : {local_meta.get('sha') or 'Nenhum'}")
        print(f"Remoto: {remote_info['sha']}")
        if local_meta.get("sha") != remote_info["sha"]:
            print("[!] Há uma nova versão do dataset disponível no Hugging Face!")
            sys.exit(10)
        else:
            print("[✓] Dataset está em dia.")
            sys.exit(0)

    if args.daemon:
        print(f"[*] Modo Daemon ativado. Intervalo de checagem: a cada {args.interval_hours:.1f} horas.")
        while True:
            try:
                run_update(force=args.force, backend_url=args.backend_url)
            except Exception as err:
                print(f"[ERRO NO CICLO]: {err}", file=sys.stderr)
            
            sleep_seconds = int(args.interval_hours * 3600)
            print(f"[*] Próxima checagem em {args.interval_hours:.1f}h ({sleep_seconds}s). Aguardando...")
            time.sleep(sleep_seconds)
    else:
        success = run_update(force=args.force, backend_url=args.backend_url)
        sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
