import time
from collections import Counter
from threading import Lock


class MetricsRegistry:
    def __init__(self) -> None:
        self._lock = Lock()
        self._requests: Counter[tuple[str, str, str]] = Counter()
        self._duration_sum: Counter[tuple[str, str, str]] = Counter()

    def record_http_request(
        self,
        *,
        method: str,
        path: str,
        status_code: int,
        duration_seconds: float,
    ) -> None:
        key = (method.upper(), path, str(status_code))
        with self._lock:
            self._requests[key] += 1
            self._duration_sum[key] += duration_seconds

    def render(self, *, app_name: str, version: str) -> str:
        lines = [
            "# HELP veripass_app_info Static application metadata.",
            "# TYPE veripass_app_info gauge",
            f'veripass_app_info{{app="{_label(app_name)}",version="{_label(version)}"}} 1',
            "# HELP veripass_http_requests_total Total HTTP requests served by the API.",
            "# TYPE veripass_http_requests_total counter",
        ]

        with self._lock:
            request_items = sorted(self._requests.items())
            duration_items = sorted(self._duration_sum.items())

        for (method, path, status), count in request_items:
            labels = _http_labels(method, path, status)
            lines.append(f"veripass_http_requests_total{{{labels}}} {count}")

        lines.extend(
            [
                "# HELP veripass_http_request_duration_seconds_sum Total HTTP request duration in seconds.",
                "# TYPE veripass_http_request_duration_seconds_sum counter",
            ]
        )
        for (method, path, status), duration in duration_items:
            labels = _http_labels(method, path, status)
            lines.append(
                f"veripass_http_request_duration_seconds_sum{{{labels}}} {duration:.6f}"
            )

        lines.extend(
            [
                "# HELP veripass_http_request_duration_seconds_count Count of measured HTTP request durations.",
                "# TYPE veripass_http_request_duration_seconds_count counter",
            ]
        )
        for (method, path, status), count in request_items:
            labels = _http_labels(method, path, status)
            lines.append(
                f"veripass_http_request_duration_seconds_count{{{labels}}} {count}"
            )

        return "\n".join(lines) + "\n"


metrics_registry = MetricsRegistry()


def monotonic_seconds() -> float:
    return time.perf_counter()


def _http_labels(method: str, path: str, status: str) -> str:
    return (
        f'method="{_label(method)}",'
        f'path="{_label(path)}",'
        f'status="{_label(status)}"'
    )


def _label(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
