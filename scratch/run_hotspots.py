import os
import sys
sys.path.append("vajra_backend")
from dotenv import load_dotenv
import numpy as np

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
from vajra_core import catalyst_app

print("=== RUNNING DBSCAN HOTSPOT DENSITY ANALYSIS ===")
coordinates = []
if catalyst_app:
    try:
        # Fetching coordinates of cases
        # Note: we use LIMIT 250 to comply with ZCQL limit of max 300 rows
        map_query = f"SELECT Latitude, Longitude, CrimeNo FROM CaseMaster WHERE Latitude IS NOT NULL LIMIT 250"
        map_res = catalyst_app.zql().execute_query(map_query)
        for r in map_res:
            cm = r.get("CaseMaster", {})
            lat = cm.get("Latitude")
            lng = cm.get("Longitude")
            if lat is not None and lng is not None:
                coordinates.append({
                    "lat": float(lat),
                    "lng": float(lng),
                    "label": cm.get("CrimeNo")
                })
    except Exception as ex:
        print(f"Failed to fetch coordinates: {ex}")

print(f"Total coordinate records fetched: {len(coordinates)}")

centroids = []
if coordinates:
    try:
        from sklearn.cluster import DBSCAN
        X = np.array([[c["lat"], c["lng"]] for c in coordinates])
        db = DBSCAN(eps=0.005, min_samples=10, metric='euclidean')
        labels = db.fit_predict(X)
        
        unique_labels = set(labels)
        if -1 in unique_labels:
            unique_labels.remove(-1)
            
        print(f"Unique clusters found: {len(unique_labels)}")
        for idx, label in enumerate(sorted(unique_labels)):
            cluster_points = X[labels == label]
            lat_center = float(np.mean(cluster_points[:, 0]))
            lng_center = float(np.mean(cluster_points[:, 1]))
            point_count = len(cluster_points)
            print(f"Cluster {idx+1}: Center ({lat_center:.5f}, {lng_center:.5f}) with {point_count} incidents.")
            centroids.append({
                "lat": lat_center,
                "lng": lng_center,
                "label": f"DBSCAN Hotspot {idx + 1} ({point_count} incidents)"
            })
    except Exception as db_err:
        print(f"DBSCAN clustering failed: {db_err}")
else:
    print("No coordinates found to cluster!")
