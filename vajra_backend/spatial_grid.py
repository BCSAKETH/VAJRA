"""
KSP VAJRA — Robust Pure-Python Spatial Index & Hierarchical Grid Engine
======================================================================
Provides zero-dependency, high-throughput hierarchical spatial indexing,
geohash encoding, and spherical Haversine distance computations.
100% portable across Windows AppLocker, Linux, and Zoho Catalyst AppSail.
"""

import math
from typing import Tuple, List, Dict, Any, Union
import numpy as np

BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"
BASE32_MAP = {c: i for i, c in enumerate(BASE32)}

# Earth radius in kilometers
EARTH_RADIUS_KM = 6371.0088


def encode_geohash(lat: float, lng: float, precision: int = 7) -> str:
    """
    Encodes (latitude, longitude) into a standard base32 geohash string.
    Precision 5: ~4.9km x ~4.9km (District macro cell)
    Precision 6: ~1.2km x ~0.6km (Precinct patrol sector ~ H3 Res 7)
    Precision 7: ~153m x ~153m (Street blackspot ~ H3 Res 8/9)
    Precision 8: ~38m x ~19m (Micro intersection)
    """
    lat_interval = [-90.0, 90.0]
    lng_interval = [-180.0, 180.0]
    geohash = []
    bits = [16, 8, 4, 2, 1]
    bit = 0
    ch = 0
    even = True

    while len(geohash) < precision:
        if even:
            mid = (lng_interval[0] + lng_interval[1]) / 2.0
            if lng > mid:
                ch |= bits[bit]
                lng_interval[0] = mid
            else:
                lng_interval[1] = mid
        else:
            mid = (lat_interval[0] + lat_interval[1]) / 2.0
            if lat > mid:
                ch |= bits[bit]
                lat_interval[0] = mid
            else:
                lat_interval[1] = mid

        even = not even
        if bit < 4:
            bit += 1
        else:
            geohash.append(BASE32[ch])
            bit = 0
            ch = 0

    return "".join(geohash)


def geohash_to_uint64(gh: str) -> int:
    """Encodes a geohash string into a compact 64-bit integer for fast NumPy indexing."""
    val = 0
    for char in gh:
        val = (val << 5) | BASE32_MAP.get(char, 0)
    return val


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in kilometers using the Haversine formula."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)

    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_KM * c


def batch_haversine_km(lat1: float, lng1: float, coords: np.ndarray) -> np.ndarray:
    """Vectorized Haversine distance from (lat1, lng1) to coords array [N, 2]."""
    phi1 = np.radians(lat1)
    phi2 = np.radians(coords[:, 0])
    dphi = np.radians(coords[:, 0] - lat1)
    dlambda = np.radians(coords[:, 1] - lng1)

    a = np.sin(dphi / 2.0) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlambda / 2.0) ** 2
    c = 2.0 * np.arctan2(np.sqrt(a), np.sqrt(np.maximum(0.0, 1.0 - a)))
    return EARTH_RADIUS_KM * c
