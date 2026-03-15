import http.client
import sys

try:
    conn = http.client.HTTPConnection("localhost", 8000)
    conn.request("GET", "/health")
    res = conn.getresponse()
    if res.status == 200:
        sys.exit(0)
    else:
        sys.exit(1)
except Exception:
    sys.exit(1)
