from fastapi import FastAPI, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import pandas as pd
import numpy as np
from sklearn.cluster import DBSCAN
from scipy.spatial import ConvexHull
import httpx
import os

print(f"DEBUG: Current working directory: {os.getcwd()}")
print(f"DEBUG: Files in CWD: {os.listdir('.')}")
print(f"DEBUG: Does dist exist? {os.path.exists('dist')}")
if os.path.exists("dist"):
    print(f"DEBUG: Files in dist: {os.listdir('dist')}")

app = FastAPI(title="Thalassa Fish Clustering API")

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = "kerala_historical_catches.csv"

def generate_synthetic_data_if_missing():
    if not os.path.exists(DATA_PATH):
        # Generate synthetic historic data along the Kerala coast
        np.random.seed(42)
        records = []
        species_list = ['sardine', 'mackerel', 'shrimp', 'tuna']
        
        # We want to create structured hotspots (clusters) representing high-yield areas
        # Species like sardine upwell in specific coastal zones during monsoon
        # Let's create 3 distinct high-density cluster nodes for each species/month combination
        for species in species_list:
            for month in range(1, 13):
                # Cluster 1: Southern Kerala (near Trivandrum/Kollam)
                lat1, lng1 = 8.5 + np.random.normal(0, 0.05), 76.5 + np.random.normal(0, 0.05)
                # Cluster 2: Central Kerala (near Kochi/Alappuzha)
                lat2, lng2 = 9.8 + np.random.normal(0, 0.05), 75.9 + np.random.normal(0, 0.05)
                # Cluster 3: Northern Kerala (near Kozhikode/Kannur)
                lat3, lng3 = 11.5 + np.random.normal(0, 0.05), 75.3 + np.random.normal(0, 0.05)
                
                clusters_coords = [(lat1, lng1), (lat2, lng2), (lat3, lng3)]
                
                # Generate points around these clusters
                for lat_center, lng_center in clusters_coords:
                    num_points = np.random.randint(5, 15)
                    for _ in range(num_points):
                        lat = lat_center + np.random.normal(0, 0.08)
                        lng = lng_center + np.random.normal(0, 0.08)
                        
                        # Add environmental metrics matching ranges in data_engine
                        sst = np.random.uniform(27.0, 29.5) if species in ['sardine', 'mackerel'] else np.random.uniform(28.0, 31.0)
                        chl = np.random.uniform(1.2, 3.5) if species == 'sardine' else np.random.uniform(0.5, 2.0)
                        yield_kg = np.random.randint(300, 1000)
                        
                        records.append([lat, lng, species, month, sst, chl, yield_kg])
                        
                # Add some random noise points (scattered)
                for _ in range(10):
                    lat = np.random.uniform(8.0, 12.8)
                    lng = np.random.uniform(74.5, 77.5)
                    sst = np.random.uniform(25.0, 32.0)
                    chl = np.random.uniform(0.1, 6.0)
                    yield_kg = np.random.randint(50, 300)
                    records.append([lat, lng, species, month, sst, chl, yield_kg])
                    
        df = pd.DataFrame(records, columns=['latitude', 'longitude', 'species', 'month', 'sst', 'chlorophyll', 'catch_yield'])
        df.to_csv(DATA_PATH, index=False)
        print(f"[Thalassa Backend] Generated synthetic historic catches CSV containing {len(df)} records.")

generate_synthetic_data_if_missing()

@app.get("/api/clusters")
def get_fish_clusters(species: str = "sardine", month: int = 7):
    if not os.path.exists(DATA_PATH):
        return {"clusters": []}
        
    df = pd.read_csv(DATA_PATH)
    # Filter by species and month
    filtered = df[(df['species'] == species.lower()) & (df['month'] == month)]
    
    if filtered.empty:
        return {"clusters": []}

    coords = filtered[['latitude', 'longitude']].values
    
    # Run DBSCAN (eps=0.2 degrees is ~22km, min_samples=4)
    db = DBSCAN(eps=0.22, min_samples=4).fit(coords)
    labels = db.labels_
    
    clusters = []
    unique_labels = set(labels) - {-1} # Exclude noise
    
    for label in unique_labels:
        cluster_mask = (labels == label)
        cluster_points = coords[cluster_mask]
        cluster_data = filtered[cluster_mask]
        
        # Calculate Convex Hull if we have 3 or more points
        hull_polygon = []
        if len(cluster_points) >= 3:
            try:
                hull = ConvexHull(cluster_points)
                # Vertices are indices in the points array
                hull_polygon = [{"lat": float(cluster_points[idx][0]), "lng": float(cluster_points[idx][1])} for idx in hull.vertices]
                # Close the polygon loop by repeating first point
                hull_polygon.append(hull_polygon[0])
            except Exception as e:
                # Fallback if points are collinear
                pass
        
        clusters.append({
            "cluster_id": int(label),
            "points_count": len(cluster_points),
            "hull_polygon": hull_polygon,
            "avg_sst": float(cluster_data['sst'].mean()),
            "avg_chlorophyll": float(cluster_data['chlorophyll'].mean()),
            "avg_yield": float(cluster_data['catch_yield'].mean())
        })
        
    return {"clusters": clusters}

@app.get("/erddap/{path:path}")
async def proxy_erddap(path: str, request: Request):
    query_params = dict(request.query_params)
    target_url = f"https://erddap.incois.gov.in/erddap/{path}"
    
    async with httpx.AsyncClient() as client:
        # Pass headers and query params, disabling strict SSL checks if servers have certificates issues
        resp = await client.get(target_url, params=query_params, verify=False)
        headers = {k: v for k, v in resp.headers.items() if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']}
        return Response(content=resp.content, status_code=resp.status_code, headers=headers)

# Mount static site build outputs
if os.path.exists("dist"):
    if os.path.exists("dist/tests"):
        app.mount("/tests", StaticFiles(directory="dist/tests", html=True), name="tests")
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")

