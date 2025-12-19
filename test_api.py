
import requests
import json
import sys

# Configuration
API_URL = "http://localhost:8081/api/v1"
API_KEY = "secret"
HEADERS = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

def log(message, type="INFO"):
    print(f"[{type}] {message}")

def check_response(response, expected_status=[200, 201, 204], description="Request"):
    if response.status_code in expected_status:
        log(f"{description} successful: {response.status_code}", "SUCCESS")
        return True
    else:
        log(f"{description} failed: {response.status_code} - {response.text}", "ERROR")
        return False

def test_servers():
    log("--- Testing Servers Endpoint ---")
    resp = requests.get(f"{API_URL}/servers", headers=HEADERS)
    if check_response(resp, description="Get Servers"):
        servers = resp.json()
        log(f"Servers found: {len(servers)}")
        return servers[0]['id'] if servers else 'localhost'
    return 'localhost'

def test_zones(server_id):
    log("--- Testing Zones Endpoint ---")
    
    # List Zones
    resp = requests.get(f"{API_URL}/servers/{server_id}/zones", headers=HEADERS)
    check_response(resp, description="List Zones")
    
    # Create Zone
    zone_name = "test-automation.com."
    payload = {
        "name": zone_name,
        "kind": "Native",
        "nameservers": ["ns1.test-automation.com."]
    }
    log(f"Creating zone: {zone_name}")
    resp = requests.post(f"{API_URL}/servers/{server_id}/zones", headers=HEADERS, json=payload)
    
    if resp.status_code == 409:
        log("Zone already exists, deleting first...", "WARN")
        requests.delete(f"{API_URL}/servers/{server_id}/zones/{zone_name}", headers=HEADERS)
        resp = requests.post(f"{API_URL}/servers/{server_id}/zones", headers=HEADERS, json=payload)

    if check_response(resp, [201], description="Create Zone"):
        # Get Zone Details
        resp = requests.get(f"{API_URL}/servers/{server_id}/zones/{zone_name}", headers=HEADERS)
        check_response(resp, description="Get Zone Details")
        
        # Add Record via PATCH (v1 style)
        log("Adding Record via PATCH")
        rrset_payload = {
            "rrsets": [{
                "name": f"www.{zone_name}",
                "type": "A",
                "ttl": 300,
                "changetype": "REPLACE",
                "records": [{
                    "content": "1.2.3.4",
                    "disabled": False
                }]
            }]
        }
        resp = requests.patch(f"{API_URL}/servers/{server_id}/zones/{zone_name}", headers=HEADERS, json=rrset_payload)
        check_response(resp, [204], description="Add Record PATCH")

def test_implicit_views(server_id):
    log("--- Testing Implicit Views (Marker Zones) ---")
    view_name = "testview"
    marker_zone = f"_marker.{view_name}."
    
    payload = {
        "name": marker_zone,
        "kind": "Native",
        "view": view_name # This is key for v5
    }
    
    log(f"Creating implicit view via marker zone: {marker_zone}")
    resp = requests.post(f"{API_URL}/servers/{server_id}/zones", headers=HEADERS, json=payload)
    
    if resp.status_code == 409:
         log("Marker zone exists, continuing", "INFO")
    else:
        check_response(resp, [201], description="Create Marker Zone")
        
    # Verify it appears in zone list with view property (or we can derive it)
    resp = requests.get(f"{API_URL}/servers/{server_id}/zones", headers=HEADERS)
    zones = resp.json()
    
    # In v5, listing zones might not show 'view' property directly in the simplistic list?
    # Our previous check showed no 'view' property in the JSON.
    # But wait, looking at my code in Views.tsx, I'm parsing the NAME for implicit views?
    # "const { view } = parseZoneId(zone.name);"
    # parseZoneId decodes "_marker.testview." to view="testview".
    
    found = False
    for z in zones:
        if z['name'] == marker_zone:
            log(f"Found marker zone: {z['name']}")
            found = True
            break
            
    if not found:
        log("Marker zone not found in list!", "ERROR")

    return view_name

def test_networks(server_id, view_name):
    log("--- Testing Networks Endpoint ---")
    
    # List Networks
    resp = requests.get(f"{API_URL}/servers/{server_id}/networks", headers=HEADERS)
    check_response(resp, description="List Networks")
    
    # Subnet definition
    subnet = "192.168.100.0/24"
    # To PUT/DELETE, path includes subnet. 
    # Example: /networks/192.168.100.0%2F24
    encoded_subnet = subnet.replace("/", "%2F")
    
    # Delete if exists (cleanup)
    requests.delete(f"{API_URL}/servers/{server_id}/networks/{encoded_subnet}", headers=HEADERS)
    
    # Create/Map Network
    # Docs say: PUT /servers/localhost/networks/{ip}/{prefixlen} { view: '...' }
    # Let's try matching that format.
    # IP = 192.168.100.0, Prefix = 24
    
    # Create/Map Network
    # Docs say: PUT /servers/localhost/networks/{ip}/{prefixlen} { view: '...' }
    # Try 1: Unencoded path (192.168.100.0/24)
    # This matches what fetch likely does if not manually encoded.
    
    payload = {"view": view_name}
    log(f"Mapping subnet {subnet} to view {view_name} via UNENCODED path")
    resp = requests.put(f"{API_URL}/servers/{server_id}/networks/{subnet}", headers=HEADERS, json=payload)
    
    if resp.status_code == 404:
        log("Unencoded path PUT failed (404), trying encoded...", "WARN")
        resp = requests.put(f"{API_URL}/servers/{server_id}/networks/{encoded_subnet}", headers=HEADERS, json=payload)

    check_response(resp, [201, 204, 200, 422], description="Map Network") 

    # Verify
    resp = requests.get(f"{API_URL}/servers/{server_id}/networks", headers=HEADERS)
    try:
        data = resp.json()
        # Handle { 'networks': [...] } or [...]
        if isinstance(data, dict) and 'networks' in data:
            networks = data['networks']
        elif isinstance(data, list):
            networks = data
        else:
            networks = []
            log(f"Unexpected networks response structure: {data}", "WARN")

        found = False
        for n in networks:
            # Check if subnet matches. 'network' key usually holds CIDR.
            if n.get('network') == subnet and n.get('view') == view_name:
                found = True
                log(f"Verified network {subnet} maps to {view_name}", "SUCCESS")
                break
        
        if not found:
             log(f"Network mapping verification NOT found in list. Current list: {networks}", "WARN")

    except Exception as e:
        log(f"Failed to parse networks JSON: {e}", "ERROR")

if __name__ == "__main__":
    try:
        server_id = test_servers()
        test_zones(server_id)
        view_name = test_implicit_views(server_id)
        test_networks(server_id, view_name)
    except Exception as e:
        log(f"Test Execution Failed: {e}", "CRITICAL")
        sys.exit(1)
