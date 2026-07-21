"""
Discover IP Webcam-style phone cameras on the local LAN.

Strategy (fast + practical for a campus demo):
  1. Detect this PC's private IP and /24 subnet.
  2. Concurrently probe http://HOST:8080/shot.jpg (IP Webcam default).
  3. Return URLs that respond with an image.
"""

from __future__ import annotations

import ipaddress
import logging
import socket
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

logger = logging.getLogger(__name__)

PROBE_TIMEOUT_SECONDS = 0.45
DEFAULT_PORT = 8080
SNAPSHOT_PATH = "/shot.jpg"
MAX_WORKERS = 48


def _primary_lan_ip() -> str | None:
    """
    IP of the interface used for normal network traffic (usually Wi‑Fi / Ethernet).
    Avoids scanning Docker bridge subnets (172.17/18/19…), which are slow and useless.
    """
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        sock.close()
        if ip and not ip.startswith("127."):
            return ip
    except OSError:
        pass
    return None


def _candidate_hosts() -> list[str]:
    primary = _primary_lan_ip()
    if not primary:
        return []

    try:
        network = ipaddress.ip_network(f"{primary}/24", strict=False)
    except ValueError:
        return []

    hosts: list[str] = []
    for host in network.hosts():
        host_s = str(host)
        if host_s != primary:
            hosts.append(host_s)
    return hosts


def probe_snapshot_url(url: str, timeout: float = PROBE_TIMEOUT_SECONDS) -> bool:
    """Return True if URL responds with image bytes."""
    try:
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": "CampusAccess-Discover/1.0",
                "Accept": "image/jpeg,image/*;q=0.8,*/*;q=0.1",
            },
            method="GET",
        )
        with urllib.request.urlopen(request, timeout=timeout) as response:
            content_type = (response.headers.get("content-type") or "").lower()
            chunk = response.read(64)
            if not chunk:
                return False
            if content_type.startswith("image/"):
                return True
            # Some phones omit content-type; JPEG magic bytes
            if chunk[:2] == b"\xff\xd8":
                return True
            return False
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return False


def _probe_host(host: str, port: int = DEFAULT_PORT) -> str | None:
    url = f"http://{host}:{port}{SNAPSHOT_PATH}"
    if probe_snapshot_url(url):
        return url
    return None


def discover_ip_webcams(port: int = DEFAULT_PORT) -> list[dict[str, Any]]:
    """
    Scan the local /24 subnet for IP Webcam snapshot endpoints.
    Typically finishes in a few seconds with concurrent probes.
    """
    hosts = _candidate_hosts()
    if not hosts:
        logger.warning("No local IPv4 subnet found for camera discovery")
        return []

    found: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(_probe_host, host, port): host for host in hosts}
        for future in as_completed(futures):
            try:
                url = future.result()
            except Exception:  # noqa: BLE001
                continue
            if url:
                host = futures[future]
                found.append(
                    {
                        "url": url,
                        "host": host,
                        "port": port,
                        "label": f"Phone camera ({host})",
                    }
                )

    found.sort(key=lambda item: tuple(int(p) for p in item["host"].split(".")))
    logger.info("IP camera discovery found %s device(s)", len(found))
    return found
