import requests
import json
import sys
import time

# Configuration
API_URL = "http://localhost:8081/api/v1"
API_KEY = "secret"
HEADERS = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

def log(message, type="INFO"):
    print(f"[{type}] {message}")

def check_response(resp, expected=[200, 201, 204], description="Request"):
    if resp.status_code in expected:
        log(f"{description} successful: {resp.status_code}", "SUCCESS")
        return True
    else:
        log(f"{description} failed: {resp.status_code} - {resp.text}", "ERROR")
        return False

def setup_clean_state():
    log("--- Cleaning up previous state ---")
    server_id = "localhost"
    # Delete test zones if they exist
    zones = ["example.com.", "example.com..testview", "_marker.testview.", "_marker.internal."]
    for z in zones:
        requests.delete(f"{API_URL}/servers/{server_id}/zones/{z}", headers=HEADERS)
    
    # Delete test networks
    networks = ["10.0.0.0/24", "192.168.1.0/24"]
    for n in networks:
        encoded = n.replace("/", "%2F")
        requests.delete(f"{API_URL}/servers/{server_id}/networks/{encoded}", headers=HEADERS)

def test_view_lifecycle(server_id="localhost"):
    log("\n--- Testing View Lifecycle ---")
    
    # 1. Create a View (Implicitly by creating a marker zone)
    view_name = "testview"
    marker_zone = f"_marker.{view_name}."
    payload = {
        "name": marker_zone,
        "kind": "Native",
        "view": view_name
    }
    
    log(f"Creating view '{view_name}' via marker zone '{marker_zone}'")
    resp = requests.post(f"{API_URL}/servers/{server_id}/zones", headers=HEADERS, json=payload)
    if not check_response(resp, [201], "Create View (Marker Zone)"):
        return False

    # 2. List Views
    log("Listing views...")
    resp = requests.get(f"{API_URL}/servers/{server_id}/views", headers=HEADERS)
    if check_response(resp, [200], "List Views"):
        views = resp.json() # v5 might return list of strings or objects? Docs say {"views": ["name", ...]}
        log(f"Views response: {views}")
        if view_name not in views.get('views', []):
            log(f"View {view_name} not found in list!", "ERROR")
            # return False # Proceeding anyway for debug

    return view_name

def test_domain_multiview(server_id="localhost", view_name="testview"):
    log("\n--- Testing Domain Multi-View ---")
    
    domain = "example.com."
    
    # 1. Create Domain in Default View (no view property implies default/no-view)
    log(f"Creating {domain} in DEFAULT view")
    payload_def = {
        "name": domain,
        "kind": "Native",
        "nameservers": ["ns1.example.com."]
    }
    resp = requests.post(f"{API_URL}/servers/{server_id}/zones", headers=HEADERS, json=payload_def)
    check_response(resp, [201], "Create Zone (Default)")
    
    # 2. Create Domain in Custom View
    log(f"Creating {domain} in '{view_name}' view")
    # TRY: Explicitly suffixing view name (PowerDNS internal format for views)
    # The normal API might expect just 'view' property, but 409 conflict suggests it's not separating them.
    # Let's try explicit name: "example.com..testview"
    # Note: domain "example.com." has trailing dot. We want "example.com" + ".." + "testview"
    domain_view = f"{domain.rstrip('.')}..{view_name}"
    
    payload_view = {
        "name": domain_view, 
        "kind": "Native",
        "nameservers": ["ns1.example.com."],
        "view": view_name # Still pass view prop just in case
    }
    resp = requests.post(f"{API_URL}/servers/{server_id}/zones", headers=HEADERS, json=payload_view)
    check_response(resp, [201], "Create Zone (Custom View)")
    
    # 3. Add Records to Default View
    log("Adding A record to Default View")
    rrset_def = {
        "rrsets": [{
            "name": f"www.{domain}",
            "type": "A",
            "ttl": 300,
            "changetype": "REPLACE",
            "records": [{"content": "1.1.1.1", "disabled": False}]
        }]
    }
    # For default view, simple path
    resp = requests.patch(f"{API_URL}/servers/{server_id}/zones/{domain}", headers=HEADERS, json=rrset_def)
    check_response(resp, [204], "Add Record (Default)")

    # 4. Add Records to Custom View
    log(f"Adding A record to '{view_name}' View")
    rrset_view = {
        "rrsets": [{
            "name": f"www.{domain}", # Name inside the RRset is usually just the FQDN
            "type": "A",
            "ttl": 300,
            "changetype": "REPLACE",
            "records": [{"content": "2.2.2.2", "disabled": False}]
        }]
    }
    
    # Target the zone by its ID (which we expect to be domain_view)
    zone_id_view = domain_view
    
    log(f"Attempting to patch zone id: {zone_id_view}")
    resp = requests.patch(f"{API_URL}/servers/{server_id}/zones/{zone_id_view}", headers=HEADERS, json=rrset_view)
    check_response(resp, [204], "Add Record (Custom View)")

    # 5. Fetch and Verify Separation
    log("Verifying record content...")
    
    if True: # defaulting to check logic directly
        # Check Default
        resp = requests.get(f"{API_URL}/servers/{server_id}/zones/{domain}", headers=HEADERS)
        if resp.status_code == 200:
            data = resp.json()
            recs = [r for r in data.get('rrsets', []) if r['name'] == f"www.{domain}" and r['type'] == 'A']
            if recs and recs[0]['records'][0]['content'] == "1.1.1.1":
                log("Default view record matches 1.1.1.1", "SUCCESS")
            else:
                log(f"Default view record mismatch or missing: {recs}", "ERROR")

        # Check View
        resp = requests.get(f"{API_URL}/servers/{server_id}/zones/{domain_view}", headers=HEADERS)
        if resp.status_code == 200:
            data = resp.json()
            recs = [r for r in data.get('rrsets', []) if r['name'] == f"www.{domain}" and r['type'] == 'A']
            if recs and recs[0]['records'][0]['content'] == "2.2.2.2":
                log("Custom view record matches 2.2.2.2", "SUCCESS")
            else:
                log(f"Custom view record mismatch or missing: {recs}", "ERROR")

def test_networks(server_id="localhost", view_name="testview"):
    log("\n--- Testing Networks ---")
    subnet = "10.0.0.0/24"
    
    # Map subnet to view
    payload = {"view": view_name}
    log(f"Mapping {subnet} to {view_name}")
    
    # Try unencoded first (standard fetch behavior often relies on this or encoded)
    # The API usually expects the ID in the path.
    resp = requests.put(f"{API_URL}/servers/{server_id}/networks/{subnet}", headers=HEADERS, json=payload)
    if resp.status_code == 404:
         encoded = subnet.replace("/", "%2F")
         resp = requests.put(f"{API_URL}/servers/{server_id}/networks/{encoded}", headers=HEADERS, json=payload)
    
    check_response(resp, [200, 201, 204], "Map Network")
    
    # Verify
    resp = requests.get(f"{API_URL}/servers/{server_id}/networks", headers=HEADERS)
    nets = resp.json()
    # nets format: [{"network": "10.0.0.0/24", "view": "testview"}, ...] or {"networks": [...]}
    if isinstance(nets, dict): nets = nets.get('networks', [])
    
    found = any(n['network'] == subnet and n.get('view') == view_name for n in nets)
    if found:
        log("Network mapping verified", "SUCCESS")
    else:
        log(f"Network mapping failed. List: {nets}", "ERROR")

if __name__ == "__main__":
    setup_clean_state()
    try:
        view = test_view_lifecycle()
        if view:
            test_domain_multiview(view_name=view)
            test_networks(view_name=view)
    except Exception as e:
        log(f"Exception: {e}", "CRITICAL")
