from dotenv import load_dotenv
load_dotenv()

import os
import json
import logging
from typing import List, Dict, Any, Optional
import numpy as np
from fastapi import Request, HTTPException, status
import zcatalyst_sdk



# Import SentenceTransformers / Scikit-learn fallback (Forced TF-IDF to avoid HF download hangs)
SENTENCE_TRANSFORMERS_AVAILABLE = False
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# Initialize Zoho Catalyst SDK client
try:
    from zcatalyst_sdk.credentials import RefreshTokenCredential
    import requests
    from zcatalyst_sdk.zcql import Zcql
    import time
    
    # Robust cached token retrieval to avoid Zoho rate limiting on restarts/hot-reloads
    def get_cached_access_token():
        token_file = os.path.join(os.path.dirname(__file__), ".token_cache")
        # Reuse cached token if it's less than 50 minutes (3000 seconds) old
        if os.path.exists(token_file):
            mtime = os.path.getmtime(token_file)
            if time.time() - mtime < 3000:
                try:
                    with open(token_file, 'r') as f:
                        t = f.read().strip()
                        if t:
                            return t
                except Exception:
                    pass
                    
        # Token is either missing, empty, or expired -> Fetch a new one
        client_id = os.getenv("CATALYST_CLIENT_ID")
        client_secret = os.getenv("CATALYST_CLIENT_SECRET")
        refresh_token = os.getenv("CATALYST_REFRESH_TOKEN")
        
        payload = {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token"
        }
        
        # Retry with exponential backoff on transient errors
        for delay in [1, 2, 4]:
            try:
                res = requests.post("https://accounts.zoho.in/oauth/v2/token", data=payload, timeout=10)
                data = res.json()
                if "access_token" in data:
                    t = data["access_token"]
                    # Write to cache file
                    with open(token_file, 'w') as f:
                        f.write(t)
                    logger.info("New Zoho OAuth access token generated and cached.")
                    return t
                else:
                    logger.error(f"Zoho accounts returned error: {data}")
            except Exception as ex:
                logger.warning(f"Error fetching access token (retrying): {ex}")
            time.sleep(delay)
            
        # Last resort fallback: read the expired/last cached token to avoid crashing
        if os.path.exists(token_file):
            with open(token_file, 'r') as f:
                return f.read().strip()
        return None

    # Patch RefreshTokenCredential.token to use our cached token
    def patched_token(self) -> str:
        t = get_cached_access_token()
        if t:
            # Update SDK's internal caching structure to satisfy it
            self._cached_token = {
                'access_token': t,
                'expires_in': int(round(time.time())) + 3600 * 1000
            }
            return t
        raise Exception("Failed to acquire access token.")
        
    RefreshTokenCredential.token = patched_token

    cred = RefreshTokenCredential({
        'client_id': os.getenv("CATALYST_CLIENT_ID"),
        'client_secret': os.getenv("CATALYST_CLIENT_SECRET"),
        'refresh_token': os.getenv("CATALYST_REFRESH_TOKEN")
    })
    
    # Initialize using AppOptions mapped from environment variables
    catalyst_app = zcatalyst_sdk.initialize_app(
        credential=cred,
        options={
            'project_id': os.getenv("CATALYST_PROJECT_ID"),
            'project_key': os.getenv("CATALYST_PROJECT_KEY"),
            'project_domain': "zoho.in" if os.getenv("CATALYST_REGION") == "IN" else "zoho.com"
        }
    )
    
    # Monkeypatch execute_query to bypass SDK Accept header bug in India region
    def patched_execute_query(self, query: str):
        logger.info(f"Patched ZCQL query: {query}")
        credential = self._app.credential
        credential._switch_user("user")
        token = credential.token()
        project_id = self._app.config.get("project_id")
        url = f"https://api.catalyst.zoho.in/baas/v1/project/{project_id}/query"
        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json",
            "X-Catalyst-Environment": "Development",
            "environment": "Development"
        }
        res = requests.post(url, headers=headers, json={"query": query})
        logger.info(f"Patched ZCQL response status: {res.status_code}")
        if res.status_code != 200:
            raise Exception(f"ZCQL query failed: {res.status_code} - {res.text}")
        return res.json().get("data", [])
        
    Zcql.execute_query = patched_execute_query
    
    # Add alias zql to CatalystApp for compatibility
    zcatalyst_sdk.CatalystApp.zql = zcatalyst_sdk.CatalystApp.zcql
    
    logger.info("Successfully initialized Zoho Catalyst SDK connection with ZCQL monkeypatch.")
except Exception as e:
    logger.critical(f"Zoho Catalyst SDK failed to initialize: {e}. Falling back to default settings.")
    catalyst_app = None


def verify_catalyst_token_direct(jwt_token: str) -> Optional[Dict[str, Any]]:
    project_id = os.getenv("CATALYST_PROJECT_ID")
    region = os.getenv("CATALYST_REGION", "IN")
    domain = "in" if region == "IN" else "com"
    url = f"https://api.catalyst.zoho.{domain}/baas/v1/project/{project_id}/project-user/current"
    
    headers = {
        "Authorization": f"Zoho-oauthtoken {jwt_token}",
        "X-Catalyst-Environment": "Development",
        "environment": "Development"
    }
    try:
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            return res.json().get("data")
        else:
            # Try with Bearer prefix
            headers["Authorization"] = f"Bearer {jwt_token}"
            res = requests.get(url, headers=headers, timeout=5)
            if res.status_code == 200:
                return res.json().get("data")
            logger.warning(f"Catalyst direct token verification failed: {res.status_code} - {res.text}")
    except Exception as e:
        logger.error(f"Error during direct token verification: {e}")
    return None


class VajraSecurityFirewall:
    """
    A live security firewall enforcing data access context.
    Reads Authorization header, validates JWT with Zoho Catalyst Auth, extracts officer profile,
    and returns the authorized station/location.
    """
    async def __call__(self, request: Request) -> str:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            logger.warning("Access denied: Missing or invalid Authorization header.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Security Access Violation: Missing or invalid 'Authorization: Bearer <token>' header."
            )
            
        jwt_token = auth_header.split(" ")[1]
        
        if not catalyst_app:
            logger.critical("Catalyst App is not initialized.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal Server Error: Database client offline."
            )
            
        try:
            # 1. Verify the JWT token via direct Zoho BaaS query only — no bypass path.
            # A prior version of this check compared jwt_token against the backend's own
            # cached service-account token and auto-authenticated as admin on a match.
            # That token is the same one used for every backend-to-Catalyst call and is
            # cached in a plaintext file on disk — treating it as a valid *user* session
            # token was a real privilege-escalation path, removed here.
            user_details = verify_catalyst_token_direct(jwt_token)

            if not user_details:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Security Access Violation: Session authentication failed."
                )

            email = user_details.get("email_id") or user_details.get("email")
            if not email:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Security Access Violation: User email not found in session."
                )
                
            kgid = email.split('@')[0]
            
            # 3. Query the user's profile from Employee table using ZQL
            zql_query = f"""
                SELECT EmployeeID, UnitID, KGID, FirstName, RankID, DesignationID
                FROM Employee
                WHERE KGID = '{kgid}'
            """
            profile_res = catalyst_app.zql().execute_query(zql_query)
            
            if not profile_res:
                # Previously fell back to an arbitrary Employee row ("LIMIT 1") when the
                # authenticated user's KGID had no match — that silently granted whoever
                # authenticated the identity/station/unit context of an unrelated employee.
                # Fail closed instead: no matching Employee record means no access.
                logger.warning(f"No Employee profile found for KGID '{kgid}'. Denying access.")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Security Access Violation: Authorized employee profile not found."
                )
                
            profile = profile_res[0].get("Employee", {})
            unit_id = profile.get("UnitID")
            rank_id = profile.get("RankID")
            designation_id = profile.get("DesignationID")

            # Fetch Unit Name
            unit_res = catalyst_app.zql().execute_query(f"SELECT UnitName FROM Unit WHERE UnitID = {unit_id}")
            unit_name = unit_res[0].get("Unit", {}).get("UnitName") if unit_res else "Unknown Station"

            # Fetch Rank and Designation names — data has existed since seeding but was
            # never queried here or exposed to the frontend/session context until now.
            rank_name = "Unknown Rank"
            if rank_id:
                rank_res = catalyst_app.zql().execute_query(f"SELECT RankName FROM Rank WHERE RankID = {rank_id}")
                if rank_res:
                    rank_name = rank_res[0].get("Rank", {}).get("RankName") or rank_name

            designation_name = "Unknown Designation"
            if designation_id:
                desig_res = catalyst_app.zql().execute_query(f"SELECT DesignationName FROM Designation WHERE DesignationID = {designation_id}")
                if desig_res:
                    designation_name = desig_res[0].get("Designation", {}).get("DesignationName") or designation_name

            # Store the user profile and location context in request.state for downstream endpoints
            request.state.user_profile = profile
            request.state.authorized_station = unit_name
            request.state.kgid = profile.get("KGID")
            request.state.rank_name = rank_name
            request.state.designation_name = designation_name

            logger.info(f"Access granted. Officer {profile.get('FirstName')} (KGID: {profile.get('KGID')}, {designation_name}/{rank_name}) authenticated for station: '{unit_name}'")
            return unit_name
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Firewall JWT auth verification failure: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Security Access Violation: Session verification failed."
            )


class MOBehavioralProfiler:
    """
    Numpy-based cosine similarity classifier engine for Modus Operandi (MO) signatures.
    Pulls historical signatures from the generated narrative database (synthetic_fir_data.json).
    """
    def __init__(self, data_path: str = "synthetic_fir_data.json"):
        self.vectors: List[np.ndarray] = []
        self.metadata: List[Dict[str, Any]] = []
        
        # Load profile signatures
        if os.path.exists(data_path):
            try:
                with open(data_path, 'r', encoding='utf-8') as f:
                    records = json.load(f)
                for r in records:
                    if "mo_vector" in r:
                        self.vectors.append(np.array(r["mo_vector"]))
                        self.metadata.append({
                            "fir_id": r.get("fir_id"),
                            "suspect_name": r.get("suspect_name"),
                            "crime_type": r.get("crime_type"),
                            "station": r.get("station")
                        })
                logger.info(f"MOBehavioralProfiler: Loaded {len(self.vectors)} historical MO vectors.")
            except Exception as e:
                logger.error(f"Failed to load MO database: {e}")
                
        if not self.vectors:
            np.random.seed(42)
            for i in range(50):
                self.vectors.append(np.random.rand(5))
                self.metadata.append({
                    "fir_id": f"FIR-2026-MOCK-{i}",
                    "suspect_name": f"Suspect-{i}",
                    "crime_type": "Theft",
                    "station": "Cubbon Park PS"
                })
                
        self.mo_matrix = np.vstack(self.vectors)
        norms = np.linalg.norm(self.mo_matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1e-9
        self.mo_matrix_normalized = self.mo_matrix / norms

    def find_matches(self, target_vector: np.ndarray, top_k: int = 3) -> List[Dict[str, Any]]:
        if len(target_vector) != 5:
            raise ValueError("Target MO signature vector must contain exactly 5 features.")
            
        target_norm = np.linalg.norm(target_vector)
        target_vector_norm = target_vector / (target_norm if target_norm > 0 else 1.0)
        
        similarities = np.dot(self.mo_matrix_normalized, target_vector_norm)
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        matches = []
        for idx in top_indices:
            matches.append({
                "case_id": self.metadata[idx]["fir_id"],
                "suspect": self.metadata[idx]["suspect_name"],
                "crime": self.metadata[idx]["crime_type"],
                "station": self.metadata[idx]["station"],
                "similarity_score": round(float(similarities[idx]), 4)
            })
        return matches


class VajraGraphRAG:
    """
    Traces multi-hop relationships between suspects by querying relational
    connections dynamically from Zoho Catalyst Datastore tables.

    This previously attempted a Neo4j connection first (bolt://localhost:7687),
    with this ZCQL path only as a fallback. Neo4j is unreachable from any real
    Catalyst deployment (no hosted graph DB in scope), so that code path never
    ran in production and never will — removed. This ZCQL tracing is the only
    path that actually runs, confirmed live against real CaseMaster data.
    """
    def __init__(self):
        pass

    def get_criminal_network(self, suspect_name: str) -> Dict[str, Any]:
        """
        Retrieves co-conspirator and related incident links by querying the
        live Catalyst tables using ZCQL.
        """
        if catalyst_app:
            try:
                # 1. Look up the suspect in our Accused table
                accused_query = f"SELECT CaseMasterID FROM Accused WHERE AccusedName LIKE '%{suspect_name}%'"
                accused_res = catalyst_app.zql().execute_query(accused_query)
                
                if accused_res:
                    case_ids = [r.get("Accused", {}).get("CaseMasterID") for r in accused_res if r.get("Accused", {}).get("CaseMasterID")]
                    if not case_ids:
                        return self._fallback_result(suspect_name)
                        
                    case_ids_str = ",".join(map(str, case_ids))
                    
                    # 2. Find other accused persons linked to the same cases
                    co_query = f"SELECT AccusedName, CaseMasterID FROM Accused WHERE CaseMasterID IN ({case_ids_str})"
                    co_res = catalyst_app.zql().execute_query(co_query)
                    co_accused_names = list(set([r.get("Accused", {}).get("AccusedName") for r in co_res if suspect_name.lower() not in r.get("Accused", {}).get("AccusedName").lower()]))
                    
                    # 3. Retrieve case details from CaseMaster
                    cases_query = f"""
                        SELECT CrimeNo, PoliceStationID 
                        FROM CaseMaster 
                        WHERE CaseMasterID IN ({case_ids_str})
                    """
                    cases_res = catalyst_app.zql().execute_query(cases_query)
                    linked_cases = []
                    for c in cases_res:
                        cm_data = c.get("CaseMaster", {})
                        crime_no = cm_data.get("CrimeNo")
                        station_id = cm_data.get("PoliceStationID")
                        
                        unit_name = "Unknown PS"
                        if station_id:
                            unit_res = catalyst_app.zql().execute_query(f"SELECT UnitName FROM Unit WHERE UnitID = {station_id}")
                            if unit_res:
                                unit_name = unit_res[0].get("Unit", {}).get("UnitName") or "Unknown PS"
                        linked_cases.append(f"{crime_no} ({unit_name})")
                    
                    return {
                        "target_suspect": suspect_name,
                        "engine_mode": "Live Zoho Catalyst ZQL Tracing",
                        "1st_degree_connections": [f"Case Link: {c}" for c in linked_cases],
                        "2nd_degree_connections": [f"Co-Accused: {co}" for co in co_accused_names],
                        "3rd_degree_connections": ["Syndicate Connection: Local Crime Cell (Grounded in shared FIRs)"]
                    }
            except Exception as e:
                logger.error(f"Failed to perform Zoho Catalyst relational GraphRAG trace: {e}")

        return self._fallback_result(suspect_name)

    def _fallback_result(self, suspect_name: str) -> Dict[str, Any]:
        return {
            "target_suspect": suspect_name,
            "engine_mode": "Static Fallback Simulation",
            "1st_degree_connections": ["Vehicle: KA-01-ME-8821", "Phone: +91-9882377182"],
            "2nd_degree_connections": ["Co-conspirator: Akash Kumar"],
            "3rd_degree_connections": ["Syndicate Connection: Bengaluru East Petty Theft Ring"]
        }

class VajraSemanticMemory:
    """
    Vector search index. Ingests narratives and computes cosine similarities.
    On startup, attempts to fetch real incident reports from Zoho Catalyst to index!
    """
    def __init__(self, data_path: str = "synthetic_fir_data.json"):
        t_start = time.time()
        self.documents: List[str] = []
        self.fir_metadata: List[Dict[str, Any]] = []
        
        # Load from live database first
        if catalyst_app:
            try:
                # Fetch all units first to avoid N+1 query overhead
                unit_map = {}
                try:
                    all_units = catalyst_app.zcql().execute_query("SELECT UnitID, UnitName FROM Unit")
                    for ur in all_units:
                        u_data = ur.get("Unit", {})
                        u_id = u_data.get("UnitID")
                        u_name = u_data.get("UnitName")
                        if u_id:
                            unit_map[int(u_id)] = u_name
                except Exception as ex:
                    logger.warning(f"Could not pre-fetch Unit table: {ex}")

                # Fetch up to 250 case master brief facts to index via ZQL
                zql_query = """
                    SELECT CrimeNo, BriefFacts, PoliceStationID 
                    FROM CaseMaster 
                    LIMIT 250
                """
                res = catalyst_app.zcql().execute_query(zql_query)
                if res:
                    for r in res:
                        cm_data = r.get("CaseMaster", {})
                        facts = cm_data.get("BriefFacts") or "No narrative summary recorded."
                        crime_no = cm_data.get("CrimeNo")
                        station_id = cm_data.get("PoliceStationID")
                        
                        unit_name = "Unknown PS"
                        if station_id and int(station_id) in unit_map:
                            unit_name = unit_map[int(station_id)]
                                
                        self.documents.append(facts)
                        self.fir_metadata.append({
                            "fir_id": crime_no,
                            "station": unit_name,
                            "crime_type": "Grounded Database Record",
                            "suspect": "Grounded suspect trace"
                        })
                    logger.info(f"VajraSemanticMemory: Indexed {len(self.documents)} live database case briefs.")
            except Exception as e:
                logger.error(f"Failed to fetch live case briefs from Zoho Catalyst via ZQL: {e}")
                import traceback
                traceback.print_exc()

        # Load synthetic documents if database index is empty
        if not self.documents:
            if os.path.exists(data_path):
                try:
                    with open(data_path, 'r', encoding='utf-8') as f:
                        records = json.load(f)
                    for r in records:
                        self.documents.append(f"{r.get('narrative_english')} | {r.get('narrative_kannada')}")
                        self.fir_metadata.append({
                            "fir_id": r.get("fir_id"),
                            "station": r.get("station"),
                            "crime_type": r.get("crime_type"),
                            "suspect": r.get("suspect_name")
                        })
                    logger.info(f"VajraSemanticMemory: Loaded {len(self.documents)} fallback synthetic logs.")
                except Exception as e:
                    logger.error(f"Failed to load fallback index: {e}")
                    
        if not self.documents:
            self.documents = ["No reports index compiled."]
            self.fir_metadata = [{"fir_id": "MOCK", "station": "Mock PS", "crime_type": "None", "suspect": "None"}]

        # Set up similarity vectorizer
        self.use_transformer = False
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                self.transformer = SentenceTransformer('all-MiniLM-L6-v2')
                self.doc_embeddings = self.transformer.encode(self.documents, show_progress_bar=False)
                self.use_transformer = True
                logger.info("SentenceTransformer embeddings generated successfully.")
            except Exception as e:
                logger.warning(f"SentenceTransformer load failure: {e}. Reverting to TF-IDF.")
                
        if not self.use_transformer:
            self.tfidf_vectorizer = TfidfVectorizer(stop_words='english')
            self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(self.documents)
            
        t_end = time.time()
        logger.info(f"VajraSemanticMemory: Initialization took {t_end - t_start:.4f} seconds.")

    def recall_context(self, query: str, top_k: int = 1) -> List[Dict[str, Any]]:
        if not self.documents or self.documents[0] == "No reports index compiled.":
            return []

        if self.use_transformer:
            query_embedding = self.transformer.encode([query], show_progress_bar=False)
            dots = np.dot(self.doc_embeddings, query_embedding.T).squeeze()
            
            # Handle boundary case if documents contains only 1 element
            if len(self.documents) == 1:
                top_indices = np.array([0])
                scores = np.array([dots])
            else:
                top_indices = np.argsort(dots)[::-1][:top_k]
                scores = dots
        else:
            query_vector = self.tfidf_vectorizer.transform([query])
            similarities = cosine_similarity(self.tfidf_matrix, query_vector).squeeze()
            
            if len(self.documents) == 1:
                top_indices = np.array([0])
                scores = np.array([similarities])
            else:
                top_indices = np.argsort(similarities)[::-1][:top_k]
                scores = similarities

        results = []
        indices = [top_indices] if isinstance(top_indices, (int, np.integer)) else list(top_indices)
        
        for idx in indices:
            score = float(scores[idx]) if hasattr(scores, '__len__') and len(scores) > 1 else float(scores)
            results.append({
                "fir_id": self.fir_metadata[idx]["fir_id"],
                "station": self.fir_metadata[idx]["station"],
                "crime_type": self.fir_metadata[idx]["crime_type"],
                "suspect": self.fir_metadata[idx]["suspect"],
                "recalled_narrative": self.documents[idx],
                "confidence_score": round(score, 4)
            })
        return results
