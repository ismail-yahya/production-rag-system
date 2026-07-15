import json
import urllib.request


def main() -> None:
    # 1. Login
    login_url = "http://localhost:8000/v1/auth/login"
    login_payload = {
        "tenant_id": "00000000-0000-0000-0000-000000000001",
        "email": "ismail.yahya@company.com",
        "password": "password123"
    }
    
    req = urllib.request.Request(
        login_url,
        data=json.dumps(login_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            token = res_data["access_token"]
            print("Login successful!")
    except Exception as e:
        print("Login failed:", e)
        return

    # 2. Get Stats
    stats_url = "http://localhost:8000/v1/admin/stats"
    req_stats = urllib.request.Request(
        stats_url,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    try:
        with urllib.request.urlopen(req_stats) as response:
            stats = json.loads(response.read().decode("utf-8"))
            print("Stats Response:", json.dumps(stats, indent=2))
    except Exception as e:
        print("Failed to get stats:", e)

if __name__ == "__main__":
    main()
