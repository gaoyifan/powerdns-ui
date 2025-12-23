#!/usr/bin/env python3

import os
import time
import yaml
import httpx

API_KEY = os.environ.get("PDNS_API_KEY", "secret")
API_URL = os.environ.get("PDNS_API_URL", "http://localhost:8081/api/v1")
CONFIG_PATH = os.environ.get("SYNC_CONFIG_PATH", "/config/views.yml")
INTERVAL = float(os.environ.get("SYNC_INTERVAL", "86400"))

client = httpx.Client(headers={"X-API-Key": API_KEY}, timeout=60.0)

def log(msg: str):
    print(f"[view-syncer] {msg}", flush=True)

def fetch_url_networks(url: str) -> list[str]:
    try:
        log(f"Fetching: {url}")
        res = client.get(url)
        res.raise_for_status()
        networks = []
        for line in res.text.splitlines():
            line = line.strip()
            if line and not line.startswith('#') and ('.' in line or ':' in line):
                networks.append(line)
        return networks
    except Exception as e:
        log(f"Fetch failed {url}: {e}")
        return []

def get_current_state():
    try:
        views = set(client.get(f"{API_URL}/servers/localhost/views").json().get("views", []))
        views.add("default")
        
        nets_res = client.get(f"{API_URL}/servers/localhost/networks").json()
        nets_list = nets_res.get("networks", []) if isinstance(nets_res, dict) else nets_res
        net_map = {n["network"]: n.get("view", "default") or "default" for n in nets_list}
        return views, net_map
    except Exception as e:
        log(f"State fetch failed: {e}")
        return None, None

def delete_view(view_name: str):
    log(f"Dropping view: {view_name}")
    try:
        res = client.get(f"{API_URL}/servers/localhost/views/{view_name}")
        if res.status_code == 404: return
        for zone in res.json().get("zones", []):
            client.delete(f"{API_URL}/servers/localhost/views/{view_name}/{zone}")
            client.delete(f"{API_URL}/servers/localhost/zones/{zone}")
    except Exception as e:
        log(f"View drop failed {view_name}: {e}")

def sync():
    if not os.path.exists(CONFIG_PATH):
        log(f"Config not found: {CONFIG_PATH}")
        return

    try:
        with open(CONFIG_PATH, "r") as f:
            config = yaml.safe_load(f) or {}
    except Exception as e:
        log(f"Config parse failed: {e}")
        return

    views_config = config.get("views", {})
    managed_only = config.get("managed_only", False)
    
    current_views, current_net_map = get_current_state()
    if current_views is None: return

    # 1. Collect desired state & Safety check
    desired_net_map = {}
    sorted_views = sorted(views_config.keys(), key=lambda k: (views_config[k].get("priority", 0) if views_config[k] else 0))

    for view_name in sorted_views:
        view_data = views_config[view_name] or {}
        view_networks = []
        
        # Static
        if "networks" in view_data:
            view_networks.extend(view_data["networks"] or [])
            
        # URL
        if "url" in view_data:
            fetched = fetch_url_networks(view_data["url"])
            if not fetched:
                log(f"ABORT: URL {view_data['url']} returned 0 networks. Safety skip.")
                return
            view_networks.extend(fetched)

        if not view_networks:
            log(f"ABORT: View {view_name} has 0 networks. Safety skip.")
            return

        for net in view_networks:
            desired_net_map[net] = view_name

    # 2. Reconcile Views
    for view_name in sorted_views:
        if view_name != "default" and view_name not in current_views:
            log(f"Creating view: {view_name}")
            client.post(f"{API_URL}/servers/localhost/views/{view_name}", json={"name": f"..{view_name}"})

    # 3. Reconcile Networks
    stats = {} # {view_name: count}
    for net, view in desired_net_map.items():
        if current_net_map.get(net) != view:
            stats[view] = stats.get(view, 0) + 1
            client.put(f"{API_URL}/servers/localhost/networks/{net}", json={"view": view})

    # 4. Managed Deletions
    cleanup_stats = {} # {old_view: count}
    if managed_only:
        for net, view in current_net_map.items():
            if view != "default" and net not in desired_net_map:
                cleanup_stats[view] = cleanup_stats.get(view, 0) + 1
                client.put(f"{API_URL}/servers/localhost/networks/{net}", json={"view": "default"})
        
        for view_name in current_views:
            if view_name != "default" and view_name not in views_config:
                delete_view(view_name)
                
    if stats:
        view_summary = ", ".join(f"{v}: {c}" for v, c in sorted(stats.items()))
        log(f"Updates: {view_summary}")
    if cleanup_stats:
        cleanup_summary = ", ".join(f"{v}: {c}" for v, c in sorted(cleanup_stats.items()))
        log(f"Cleaned (to default): {cleanup_summary}")

if __name__ == "__main__":
    log(f"Started. Interval: {INTERVAL}s")
    while True:
        try:
            sync()
        except Exception as e:
            log(f"Loop error: {e}")
        time.sleep(INTERVAL)
