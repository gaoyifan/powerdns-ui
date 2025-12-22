#!/usr/bin/env python3

"""
Sidecar: watch secondary PDNS logs and automatically set `AXFR-MASTER-TSIG`
for new catalog member zones created by Catalog Zones.

Run:
  uv run --with docker tsig-activator.py

Requires:
  - /var/run/docker.sock mounted
"""

from __future__ import annotations

import os
import re
import threading
import time

import docker  # type: ignore


CREATE_RE = re.compile(r"Catalog-Zone create zone '([^']+)'")


def log(msg: str) -> None:
    print(f"[tsig-sidecar] {msg}", flush=True)


def exec_pdnsutil(sec_container, args: list[str]) -> tuple[int, str, str]:
    res = sec_container.exec_run(["pdnsutil", *args], demux=True)
    code = int(res.exit_code or 0)
    out_b, err_b = res.output if res.output is not None else (b"", b"")
    out = (out_b or b"").decode("utf-8", errors="replace")
    err = (err_b or b"").decode("utf-8", errors="replace")
    return code, out, err


def list_secondary_zones(sec_container) -> list[str]:
    code, out, err = exec_pdnsutil(sec_container, ["zone", "list-all", "secondary"])
    if code != 0:
        log(f"WARN: pdnsutil zone list-all secondary failed: {err.strip()}")
        return []
    return [line.split()[0] for line in out.splitlines() if line.strip()]


def get_axfr_master_tsig(sec_container, zone: str) -> str:
    code, out, _ = exec_pdnsutil(sec_container, ["metadata", "get", zone, "AXFR-MASTER-TSIG"])
    if code != 0:
        return ""
    for line in out.splitlines():
        if line.startswith("AXFR-MASTER-TSIG ="):
            return line.split("=", 1)[1].strip()
    return ""


def ensure_zone_tsig(sec_container, zone: str, tsig_name: str, catalog_zone: str | None) -> None:
    if catalog_zone and zone == catalog_zone:
        return
    meta = get_axfr_master_tsig(sec_container, zone)
    if tsig_name and tsig_name in meta:
        return
    log(f"Setting AXFR-MASTER-TSIG for zone '{zone}' -> '{tsig_name}'")
    code, _out, err = exec_pdnsutil(sec_container, ["metadata", "set", zone, "AXFR-MASTER-TSIG", tsig_name])
    if code != 0:
        log(f"WARN: failed to set AXFR-MASTER-TSIG for '{zone}': {err.strip()}")


def main() -> int:
    sec_name = os.environ.get("PDNS_SECONDARY_CONTAINER", "pdns-secondary-pdns-1")
    tsig_name = os.environ.get("PDNS_TSIG_NAME", "")
    if not tsig_name:
        log("ERROR: PDNS_TSIG_NAME is required")
        return 2

    catalog_zone = os.environ.get("PDNS_CATALOG_ZONE") or None

    client = docker.DockerClient(base_url="unix:///var/run/docker.sock")

    # Wait for secondary container to exist
    sec_container = None
    for _ in range(60):
        try:
            sec_container = client.containers.get(sec_name)
            break
        except Exception:
            time.sleep(1)
    if sec_container is None:
        log(f"ERROR: secondary container '{sec_name}' not found")
        return 2

    log(f"Started. secondary='{sec_name}' tsig='{tsig_name}' catalog='{catalog_zone or '<unset>'}'")

    scan_interval = float(os.environ.get("SCAN_INTERVAL", "2"))

    # Periodic scan (covers missed log lines / late sidecar startup)
    def _scan_forever() -> None:
        while True:
            try:
                for z in list_secondary_zones(sec_container):
                    ensure_zone_tsig(sec_container, z, tsig_name, catalog_zone)
            except Exception as e:
                log(f"WARN: scan failed: {e!r}")
            time.sleep(scan_interval)

    threading.Thread(target=_scan_forever, daemon=True).start()

    # One immediate scan so we don't wait for the first interval tick.
    for z in list_secondary_zones(sec_container):
        ensure_zone_tsig(sec_container, z, tsig_name, catalog_zone)

    # Then follow logs (tip: `for line in container.logs(stream=True):`)
    for raw in sec_container.logs(stream=True, follow=True, since=1):
        line = raw.decode("utf-8", errors="replace").rstrip("\n")
        m = CREATE_RE.search(line)
        if not m:
            continue
        zone = m.group(1)
        log(f"Detected new member zone from logs: '{zone}'")
        ensure_zone_tsig(sec_container, zone, tsig_name, catalog_zone)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())


