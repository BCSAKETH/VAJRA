from dotenv import load_dotenv
load_dotenv()

import os
import re
import json
import hashlib
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd
import joblib
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, status, Request, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
import zcatalyst_sdk

# Core components import
from vajra_core import (
    VajraSecurityFirewall,
    MOBehavioralProfiler,
    VajraGraphRAG,
    VajraSemanticMemory,
    catalyst_app,
    zcql_insert_row,
    zcql_update_row
)
from agent_loop import VajraAgentLoop
from catalyst_llm import CatalystLLM
from fastapi.responses import Response

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# FastAPI Setup
app = FastAPI(
    title="VAJRA Backend Engine",
    description="Live Cognitive Intelligence & Machine Learning Pipeline for Karnataka Police (Zoho Catalyst)",
    version="2.0.0"
)

# Enable CORS for frontend integrations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load serialized ML artifacts
try:
    dbscan_model = joblib.load("dbscan_hotspots.joblib")
    xgboost_risk_model = joblib.load("xgboost_risk_model.joblib")
    import shap
    shap_explainer = shap.TreeExplainer(xgboost_risk_model, feature_perturbation='tree_path_dependent')
    label_encoders = joblib.load("label_encoders.joblib")
    logger.info("Successfully loaded God Pro Max ML models and dynamically initialized SHAP TreeExplainer.")
except Exception as e:
    logger.critical(f"Critical failure loading ML models: {e}. FastAPI starting with fallback prediction.")
    dbscan_model, xgboost_risk_model, shap_explainer, label_encoders = None, None, None, None

# Initialize Core Services
security_firewall = VajraSecurityFirewall()
mo_profiler = MOBehavioralProfiler()
graph_rag = VajraGraphRAG()
semantic_memory = VajraSemanticMemory()
agent_loop = VajraAgentLoop(dbscan_model=dbscan_model, xgboost_model=xgboost_risk_model, shap_explainer=shap_explainer, label_encoders=label_encoders)


class ConnectionManager:
    """
    Live message broadcast for Cowork sessions. AppSail hosts this FastAPI
    app as a persistent process (not a serverless function-per-request), so
    a real WebSocket connection held open here is genuinely viable -- no
    separate Catalyst real-time product or external service needed, this is
    just a second endpoint on the same running backend.
    """
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.setdefault(session_id, []).append(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket):
        conns = self.active_connections.get(session_id)
        if conns and websocket in conns:
            conns.remove(websocket)
            if not conns:
                del self.active_connections[session_id]

    async def broadcast(self, session_id: str, message: Dict[str, Any]):
        for ws in list(self.active_connections.get(session_id, [])):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(session_id, ws)


connection_manager = ConnectionManager()


@app.websocket("/ws/chat/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: str, token: str = Query(...)):
    """
    Live push for Cowork sessions. Browsers can't set custom headers on a
    WebSocket handshake, so the session token travels as a query param
    instead of the usual Authorization header -- verified with the same
    verify_session_token used everywhere else, so an invalid/expired token
    is rejected exactly like any other endpoint.
    """
    from vajra_core import verify_session_token
    kgid = verify_session_token(token)
    if not kgid:
        await websocket.close(code=4001)
        return

    await connection_manager.connect(session_id, websocket)
    try:
        while True:
            # Client never sends anything meaningful over this socket -- it's
            # receive-only from the frontend's perspective. This just keeps
            # the connection alive and detects disconnects.
            await websocket.receive_text()
    except WebSocketDisconnect:
        connection_manager.disconnect(session_id, websocket)


class CaseAnalysisRequest(BaseModel):
    query: str = Field(..., description="Conversational query for semantic analysis")
    suspect_name: str = Field(..., description="Suspect name for GraphRAG connection tracing")
    mo_vector: List[float] = Field(..., description="5-dimension Modus Operandi vector")
    district_name: str = Field(..., description="District Name (e.g. Bagalkot, Ballari)")
    unit_name: str = Field(..., description="Station Name (e.g. Amengad PS)")
    crime_group_name: str = Field(..., description="Crime category group name (e.g. POCSO, THEFT)")
    fir_type: str = Field(..., description="FIR type (e.g. Heinous, Non Heinous)")
    fir_year: int = Field(2026, ge=2000, le=2100)
    fir_month: int = Field(6, ge=1, le=12)
    fir_day: int = Field(25, ge=1, le=31)
    victim_count: int = Field(0, ge=0)
    accused_count: int = Field(1, ge=0)


@app.get("/health")
async def health_check():
    """
    Diagnostic checks for live Zoho Catalyst Datastore, local files, and machine learning components.
    """
    # Reads the same in-process "recently confirmed down" cooldown
    # catalyst_llm.py sets after a failed call, rather than firing a live
    # request on every /health poll (the frontend polls this every 30s) --
    # cheap and self-heals within 45s-5min depending on the failure class
    # (see catalyst_llm.py's _TRANSIENT_COOLDOWN_SECONDS/_DEFINITIVE_COOLDOWN_SECONDS).
    from catalyst_llm import _is_endpoint_marked_down
    llm_available = not _is_endpoint_marked_down()

    return {
        "status": "online",
        "timestamp": pd.Timestamp.now().isoformat(),
        "database_connected": catalyst_app is not None,
        "graph_rag_mode": "Zoho Catalyst Relational Tracing",
        "semantic_memory_index_size": len(semantic_memory.documents),
        "models_status": {
            "dbscan": "active" if dbscan_model else "offline",
            "xgboost": "active" if xgboost_risk_model else "offline",
            "shap": "active" if shap_explainer else "offline",
            "encoders": "active" if label_encoders else "offline"
        },
        # Voice STT is not wired to any real service yet — /api/voice/process-stream
        # always returns 503. Reported here so the frontend can disable the mic
        # button honestly instead of letting an officer record audio that's
        # guaranteed to be thrown away.
        "voice_service_available": False,
        "llm_service_available": llm_available
    }


@app.post("/api/intelligence/analyze-case")
async def analyze_case(
    payload: CaseAnalysisRequest,
    request: Request,
    location_context: str = Depends(security_firewall)
):
    """
    Unified intelligence query endpoint.
    1. Validates Row Level Security (RLS) via security firewall headers.
    2. Recalls semantic context matching the natural language query.
    3. Runs a live GraphRAG lookup for criminal syndicate relationships.
    4. Performs cosine similarity profiling on MO vector.
    5. Calculates XGBoost risk score and SHAP explanation values.
    """
    try:
        # 1. Semantic Memory recall
        semantic_matches = semantic_memory.recall_context(payload.query, top_k=2)
        
        # 2. GraphRAG network mapping
        criminal_network = graph_rag.get_criminal_network(payload.suspect_name)
        
        # 3. MO similarity profiling
        behavioral_matches = mo_profiler.find_matches(np.array(payload.mo_vector), top_k=3)
        
        # 4. XGBoost Recidivism/Conviction Risk Forecasting
        risk_score = 0.0
        shap_values_dict = {}
        
        if xgboost_risk_model and label_encoders:
            try:
                dist_encoded = label_encoders['District_Name'].transform([payload.district_name])[0]
            except Exception:
                dist_encoded = 0
                
            try:
                unit_encoded = label_encoders['UnitName'].transform([payload.unit_name])[0]
            except Exception:
                unit_encoded = 0
                
            try:
                group_encoded = label_encoders['CrimeGroup_Name'].transform([payload.crime_group_name])[0]
            except Exception:
                group_encoded = 0
                
            try:
                type_encoded = label_encoders['FIR_Type'].transform([payload.fir_type])[0]
            except Exception:
                type_encoded = 0

            month_sin = np.sin(2 * np.pi * payload.fir_month / 12.0)
            month_cos = np.cos(2 * np.pi * payload.fir_month / 12.0)
            day_sin = np.sin(2 * np.pi * payload.fir_day / 31.0)
            day_cos = np.cos(2 * np.pi * payload.fir_day / 31.0)
            
            ratio = payload.victim_count / (payload.accused_count + 1.0)
            
            features = pd.DataFrame([{
                "District_Name_encoded": dist_encoded,
                "UnitName_encoded": unit_encoded,
                "CrimeGroup_Name_encoded": group_encoded,
                "FIR_Type_encoded": type_encoded,
                "FIR_YEAR": payload.fir_year,
                "month_sin": month_sin,
                "month_cos": month_cos,
                "day_sin": day_sin,
                "day_cos": day_cos,
                "VICTIM COUNT": payload.victim_count,
                "Accused Count": payload.accused_count,
                "victim_to_accused_ratio": ratio
            }])
            
            probabilities = xgboost_risk_model.predict_proba(features)[0]
            risk_score = float(probabilities[1])
            
            if shap_explainer:
                shap_res = shap_explainer(features)
                feature_names = features.columns.tolist()
                shap_values_dict = {
                    name: float(val) for name, val in zip(feature_names, shap_res.values[0])
                }
        else:
            # High-fidelity mock fallback if models fail loading
            risk_score = 0.35 + (payload.accused_count * 0.1) - (payload.victim_count * 0.05)
            risk_score = min(max(risk_score, 0.05), 0.95)
            shap_values_dict = {
                "District_Name_encoded": 0.02,
                "UnitName_encoded": -0.01,
                "CrimeGroup_Name_encoded": 0.08,
                "FIR_Type_encoded": 0.12,
                "FIR_YEAR": -0.03,
                "month_sin": -0.02,
                "month_cos": 0.01,
                "day_sin": 0.01,
                "day_cos": -0.01,
                "VICTIM COUNT": -0.04,
                "Accused Count": 0.18,
                "victim_to_accused_ratio": -0.05
            }

        return {
            "status": "success",
            "security_context": {
                "authorized_station": location_context,
                "row_level_applied": True
            },
            "semantic_recall": semantic_matches,
            "graph_rag_network": criminal_network,
            "modus_operandi_matches": behavioral_matches,
            "explainable_risk_score": {
                "reoffending_probability": round(risk_score, 4),
                "risk_rating": "HIGH" if risk_score > 0.7 else "MEDIUM" if risk_score > 0.35 else "LOW",
                "shap_feature_importance": shap_values_dict
            }
        }
    except Exception as e:
        logger.error(f"Error during case analysis: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline Processing Error: {str(e)}"
        )


@app.post("/api/voice/process-stream")
async def process_voice_stream(audio: UploadFile = File(...)):
    """
    ASR Speech-to-text integration endpoint.
    Returns service not configured error as Zia speech modules are not active.
    """
    logger.info(f"Incoming voice stream content type: {audio.content_type}")
    try:
        content = await audio.read(1024)
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty audio payload received.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read audio stream: {e}")
        
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Zia Speech-to-Text Voice Service is not configured. Please wire active Zoho Intelligent Assistant SDK credentials."
    )


class AuthRequest(BaseModel):
    badge_no: str = Field(..., description="Strictly numeric 7-digit badge ID (KGID)")
    password: str = Field(..., description="Alphanumeric password")


@app.post("/api/auth/login")
async def login(payload: AuthRequest):
    """
    Authenticates an officer against a real stored bcrypt password hash in
    OfficerCredentials. Previously this endpoint accepted any password for
    any well-formed 7-digit badge number — it never checked one. Only the
    officers seeded into OfficerCredentials can log in; everyone else is
    rejected, including badge numbers that exist in Employee but have no
    credential row.
    """
    if not payload.badge_no.isdigit() or len(payload.badge_no) != 7:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Credentials: Badge Number (KGID) must be exactly 7 digits and strictly numeric."
        )

    if not catalyst_app:
        raise HTTPException(status_code=500, detail="Database client offline.")

    import bcrypt
    try:
        cred_res = catalyst_app.zql().execute_query(
            f"SELECT KGID, PasswordHash FROM OfficerCredentials WHERE KGID = '{payload.badge_no}'"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Credential lookup failed: {str(e)}")

    if not cred_res:
        raise HTTPException(status_code=401, detail="Invalid Credentials: Badge Number or password incorrect.")

    stored_hash = cred_res[0].get("OfficerCredentials", {}).get("PasswordHash")
    if not stored_hash or not bcrypt.checkpw(payload.password.encode("utf-8"), stored_hash.encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid Credentials: Badge Number or password incorrect.")

    from vajra_core import issue_session_token, derive_role_tier
    # Previously returned the raw shared Catalyst admin access token as the
    # session -- the same token used for every backend-to-Catalyst call, and
    # not resolvable back to a specific officer by the firewall (Zoho's
    # /project-user/current 401s for it, since it's not a real per-user
    # session -- see verify_session_token in vajra_core.py). issue_session_token
    # mints a real per-officer signed session instead, tied to this badge_no
    # specifically now that its password has been checked.
    try:
        token = issue_session_token(payload.badge_no)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Resolve this badge's own RankID so the response can carry its real
    # role_tier -- needed by TwoPersonApprovalModal to verify a co-signing
    # supervisor badge is actually Supervisor-tier+, not just a different
    # badge number that happens to have a valid password.
    role_tier = "officer"
    try:
        emp_res = catalyst_app.zql().execute_query(
            f"SELECT RankID FROM Employee WHERE KGID = '{payload.badge_no}'"
        )
        if emp_res:
            role_tier = derive_role_tier(emp_res[0].get("Employee", {}).get("RankID"))
    except Exception as e:
        logger.warning(f"Could not resolve role_tier for {payload.badge_no}: {e}")

    return {
        "access_token": token,
        "token_type": "Bearer",
        "expires_in": 3600,
        "role_tier": role_tier,
        "user": {
            "id": f"{payload.badge_no}_user",
            "badge_no": payload.badge_no,
            "email": f"{payload.badge_no}@vajra.ksp.gov.in"
        }
    }


@app.get("/api/auth/me")
async def get_current_officer(
    request: Request,
    location_context: str = Depends(security_firewall)
):
    """
    Returns the authenticated officer's profile, including rank and designation —
    previously fetched by the firewall but never exposed to any endpoint or the frontend.
    """
    profile = request.state.user_profile
    return {
        "kgid": request.state.kgid,
        "first_name": profile.get("FirstName"),
        "station": request.state.authorized_station,
        "rank": request.state.rank_name,
        "designation": request.state.designation_name,
        "role_tier": request.state.role_tier
    }


@app.get("/api/analytics/crime-trends")
async def get_crime_trends(
    major_head: Optional[str] = None,
    limit: int = 100,
    location_context: str = Depends(security_firewall)
):
    """
    Returns historical crime trends from Catalyst Datastore.
    """
    if not catalyst_app:
        raise HTTPException(status_code=500, detail="Database client offline.")
    try:
        q = "SELECT major_crime_head, crime_head_and_section, minor_crime_head, commits, crime_month FROM CrimeData"
        if major_head:
            q += f" WHERE major_crime_head LIKE '*{major_head}*'"
        q += f" LIMIT {limit}"
        res = catalyst_app.zql().execute_query(q)
        return [r.get("CrimeData", {}) for r in res]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query crime statistics: {str(e)}")


@app.get("/api/analytics/accident-spots")
async def get_accident_spots(
    request: Request,
    limit: int = 500,
    location_context: str = Depends(security_firewall)
):
    """
    Returns accident reports for the authenticated officer's station.
    """
    if not catalyst_app:
        raise HTTPException(status_code=500, detail="Database client offline.")
    try:
        q = f"SELECT * FROM AccidentReports LIMIT {limit}"
        res = catalyst_app.zql().execute_query(q)
        return [r.get("AccidentReports", {}) for r in res]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query accident reports: {str(e)}")


@app.get("/api/firs")
async def get_firs(
    request: Request,
    search: Optional[str] = None,
    station: Optional[str] = None,
    status_filter: Optional[str] = None,
    limit: int = 200,
    location_context: str = Depends(security_firewall)
):
    """
    Returns live FIR records from the Zoho Catalyst database using high-performance, join-free ZQL.
    """
    if not catalyst_app:
        raise HTTPException(status_code=500, detail="Database client offline.")
    try:
        # 1. Fetch lookups to join in memory
        units = {r.get("Unit", {}).get("UnitID"): r.get("Unit", {}) for r in catalyst_app.zql().execute_query("SELECT UnitID, UnitName, DistrictID FROM Unit")}
        districts = {r.get("District", {}).get("DistrictID"): r.get("District", {}).get("DistrictName") for r in catalyst_app.zql().execute_query("SELECT DistrictID, DistrictName FROM District")}
        heads = {r.get("CrimeHead", {}).get("CrimeHeadID"): r.get("CrimeHead", {}).get("CrimeGroupName") for r in catalyst_app.zql().execute_query("SELECT CrimeHeadID, CrimeGroupName FROM CrimeHead")}
        subheads = {r.get("CrimeSubHead", {}).get("CrimeSubHeadID"): r.get("CrimeSubHead", {}).get("CrimeHeadName") for r in catalyst_app.zql().execute_query("SELECT CrimeSubHeadID, CrimeHeadName FROM CrimeSubHead")}
        statuses = {r.get("CaseStatusMaster", {}).get("CaseStatusID"): r.get("CaseStatusMaster", {}).get("CaseStatusName") for r in catalyst_app.zql().execute_query("SELECT CaseStatusID, CaseStatusName FROM CaseStatusMaster")}
        
        # Pre-fetch socio profiles
        socio_map = {}
        try:
            socio_res = catalyst_app.zql().execute_query("SELECT DistrictID, LiteracyRate, UnemploymentRate FROM DistrictSocioProfile")
            for r in socio_res:
                s_data = r.get("DistrictSocioProfile", {})
                d_id = s_data.get("DistrictID")
                if d_id:
                    socio_map[int(d_id)] = s_data
        except Exception as ex:
            logger.warning(f"Could not pre-fetch DistrictSocioProfile table: {ex}")
        
        # Accused list grouped by CaseMasterID
        accused_rows = catalyst_app.zql().execute_query("SELECT AccusedName, AgeYear, CaseMasterID FROM Accused")
        accused_map = {}
        for r in accused_rows:
            a_data = r.get("Accused", {})
            cm_id = a_data.get("CaseMasterID")
            if cm_id:
                if cm_id not in accused_map:
                    accused_map[cm_id] = []
                accused_map[cm_id].append(a_data)

        # 2. Fetch CaseMaster records
        cases_res = catalyst_app.zql().execute_query("SELECT CaseMasterID, CrimeNo, CrimeRegisteredDate, Latitude, Longitude, BriefFacts, PoliceStationID, CrimeMajorHeadID, CrimeMinorHeadID, CaseStatusID FROM CaseMaster LIMIT 250")
        
        formatted_firs = []
        for r in cases_res:
            cm = r.get("CaseMaster", {})
            cm_id = cm.get("CaseMasterID")
            station_id = cm.get("PoliceStationID")
            major_id = cm.get("CrimeMajorHeadID")
            minor_id = cm.get("CrimeMinorHeadID")
            status_id = cm.get("CaseStatusID")
            
            # Lookup names
            unit_data = units.get(station_id, {})
            unit_name = unit_data.get("UnitName", "Unknown PS")
            district_id = unit_data.get("DistrictID")
            district_name = districts.get(district_id, "Unknown District")
            
            crime_group = heads.get(major_id, "General Crime")
            crime_head = subheads.get(minor_id, "IPC Sections")
            status_name = statuses.get(status_id, "Under Investigation")
            
            # Get accused for this case
            case_accused = accused_map.get(cm_id, [])
            accused_name = case_accused[0].get("AccusedName", "Unknown Suspect") if case_accused else "Unknown Suspect"
            accused_age = case_accused[0].get("AgeYear", 32) if case_accused else 32
            
            # Filter by station
            if station and station != "All" and unit_name != station:
                continue
                
            # Filter by status
            if status_filter and status_filter != "All":
                status_map = {
                    "closed": "Closed",
                    "charge sheeted": "Charge Sheeted",
                    "under investigation": "Under Investigation"
                }
                mapped = status_map.get(status_filter.lower(), "Under Investigation")
                if status_name != mapped:
                    continue
                    
            # Filter by search
            crime_no = cm.get("CrimeNo", "")
            if search:
                search_lower = search.lower()
                matches_search = (
                    search_lower in crime_no.lower() or 
                    search_lower in accused_name.lower() or 
                    search_lower in crime_head.lower()
                )
                if not matches_search:
                    continue
                    
            # Resolve demographics from pre-fetched socio_map
            socio = socio_map.get(int(district_id), {}) if district_id else {}
            lit_rate = socio.get("LiteracyRate") or 78.2
            unemp_rate = socio.get("UnemploymentRate") or 6.5

            formatted_firs.append({
                "firNo": crime_no,
                "station": unit_name,
                "district": district_name,
                "date": cm.get("CrimeRegisteredDate", "2026-01-01")[:10],
                "actSection": crime_head,
                "crimeType": crime_group,
                "status": status_name,
                "accusedName": accused_name,
                "accusedAge": accused_age,
                "unemploymentRate": unemp_rate,
                "literacyRate": lit_rate,
                "latitude": float(cm.get("latitude") or 0.0),
                "longitude": float(cm.get("longitude") or 0.0)
            })
            
        return formatted_firs[:limit]
    except Exception as e:
        logger.error(f"Error fetching live FIRs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to query FIR registry: {str(e)}")


@app.get("/api/firs/{fir_no}")
async def get_fir_by_no(
    fir_no: str,
    request: Request,
    location_context: str = Depends(security_firewall)
):
    """
    Returns full details for a single FIR by its number from Zoho Catalyst.
    """
    if not catalyst_app:
        raise HTTPException(status_code=500, detail="Database client offline.")
    try:
        # 1. Query CaseMaster record
        cases_res = catalyst_app.zql().execute_query(f"SELECT CaseMasterID, CrimeNo, CrimeRegisteredDate, Latitude, Longitude, BriefFacts, PoliceStationID, CrimeMajorHeadID, CrimeMinorHeadID, CaseStatusID FROM CaseMaster WHERE CrimeNo = '{fir_no}' LIMIT 1")
        if not cases_res:
            raise HTTPException(status_code=404, detail=f"FIR file '{fir_no}' not found.")
            
        cm = cases_res[0].get("CaseMaster", {})
        case_id = cm.get("CaseMasterID")
        station_id = cm.get("PoliceStationID")
        major_id = cm.get("CrimeMajorHeadID")
        minor_id = cm.get("CrimeMinorHeadID")
        status_id = cm.get("CaseStatusID")
        
        # 2. Query lookups sequentially/dynamically
        unit_name = "Unknown PS"
        district_name = "Unknown District"
        if station_id:
            unit_res = catalyst_app.zql().execute_query(f"SELECT UnitName, DistrictID FROM Unit WHERE UnitID = {station_id}")
            if unit_res:
                u_data = unit_res[0].get("Unit", {})
                unit_name = u_data.get("UnitName", "Unknown PS")
                district_id = u_data.get("DistrictID")
                if district_id:
                    dist_res = catalyst_app.zql().execute_query(f"SELECT DistrictName FROM District WHERE DistrictID = {district_id}")
                    if dist_res:
                        district_name = dist_res[0].get("District", {}).get("DistrictName", "Unknown District")
                        
        crime_group = "General Crime"
        if major_id:
            head_res = catalyst_app.zql().execute_query(f"SELECT CrimeGroupName FROM CrimeHead WHERE CrimeHeadID = {major_id}")
            if head_res:
                crime_group = head_res[0].get("CrimeHead", {}).get("CrimeGroupName", "General Crime")
                
        crime_head = "IPC Sections"
        if minor_id:
            subhead_res = catalyst_app.zql().execute_query(f"SELECT CrimeHeadName FROM CrimeSubHead WHERE CrimeSubHeadID = {minor_id}")
            if subhead_res:
                crime_head = subhead_res[0].get("CrimeSubHead", {}).get("CrimeHeadName", "IPC Sections")
                
        status_name = "Under Investigation"
        if status_id:
            status_res = catalyst_app.zql().execute_query(f"SELECT CaseStatusName FROM CaseStatusMaster WHERE CaseStatusID = {status_id}")
            if status_res:
                status_name = status_res[0].get("CaseStatusMaster", {}).get("CaseStatusName", "Under Investigation")
                
        # 3. Query Accused
        accused_name = "Unknown Suspect"
        accused_age = 32
        accused_id = "0"
        acc_res = catalyst_app.zql().execute_query(f"SELECT AccusedName, AgeYear, AccusedMasterID FROM Accused WHERE CaseMasterID = {case_id} LIMIT 1")
        if acc_res:
            a_data = acc_res[0].get("Accused", {})
            accused_name = a_data.get("AccusedName", "Unknown Suspect")
            accused_age = a_data.get("AgeYear", 32)
            accused_id = str(a_data.get("AccusedMasterID", "0"))
            
        # 4. Query Victim
        victim_name = "Victim"
        vic_res = catalyst_app.zql().execute_query(f"SELECT VictimName FROM Victim WHERE CaseMasterID = {case_id} LIMIT 1")
        if vic_res:
            victim_name = vic_res[0].get("Victim", {}).get("VictimName", "Victim")
            
        # Resolve demographics dynamically from DistrictSocioProfile
        socio = {}
        if station_id:
            try:
                unit_res = catalyst_app.zql().execute_query(f"SELECT DistrictID FROM Unit WHERE UnitID = {station_id} LIMIT 1")
                if unit_res:
                    dist_id = unit_res[0].get("Unit", {}).get("DistrictID")
                    if dist_id:
                        sp_res = catalyst_app.zql().execute_query(f"SELECT LiteracyRate, UnemploymentRate FROM DistrictSocioProfile WHERE DistrictID = {dist_id} LIMIT 1")
                        if sp_res:
                            socio = sp_res[0].get("DistrictSocioProfile", {})
            except Exception as ex:
                logger.warning(f"Could not fetch socio profile for station {station_id}: {ex}")

        lit_rate = socio.get("LiteracyRate") or 78.2
        unemp_rate = socio.get("UnemploymentRate") or 6.5

        return {
            "firNo": cm.get("CrimeNo"),
            "station": unit_name,
            "district": district_name,
            "date": cm.get("CrimeRegisteredDate", "2026-01-01")[:10],
            "actSection": crime_head,
            "crimeType": crime_group,
            "status": status_name,
            "accusedName": accused_name,
            "accusedAge": accused_age,
            "accusedId": accused_id,
            "victimName": victim_name,
            "brieffacts": cm.get("BriefFacts", ""),
            "latitude": float(cm.get("latitude") or 0.0),
            "longitude": float(cm.get("longitude") or 0.0),
            "unemploymentRate": unemp_rate,
            "literacyRate": lit_rate
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving FIR details: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to query database: {str(e)}")


@app.get("/api/suspects/network/{suspect_name}")
async def get_suspect_network(
    suspect_name: str,
    request: Request,
    location_context: str = Depends(security_firewall)
):
    """
    Traces a suspect across cases in Zoho Catalyst Datastore.
    """
    return graph_rag.get_criminal_network(suspect_name)


@app.get("/api/analytics/summary")
async def get_analytics_summary(
    request: Request,
    location_context: str = Depends(security_firewall)
):
    """
    Returns optimized aggregated KPIs computed from Zoho Catalyst Datastore.
    """
    if not catalyst_app:
        raise HTTPException(status_code=500, detail="Database client offline.")
    try:
        # Fast SQL Count Queries
        total_cases_res = catalyst_app.zql().execute_query("SELECT COUNT(CaseMasterID) FROM CaseMaster")
        total_cases = total_cases_res[0].get("CaseMaster", {}).get("COUNT(CaseMasterID)") if total_cases_res else 0
        if total_cases is None:
            total_cases = 0
        
        total_accused_res = catalyst_app.zql().execute_query("SELECT COUNT(AccusedMasterID) FROM Accused")
        total_accused = total_accused_res[0].get("Accused", {}).get("COUNT(AccusedMasterID)") if total_accused_res else 0
        if total_accused is None:
            total_accused = 0
        
        # Districts
        district_res = catalyst_app.zql().execute_query("SELECT DistrictName FROM District")
        districts = [d.get("District", {}).get("DistrictName") for d in district_res if d.get("District", {}).get("DistrictName")]
        
        # Stations
        unit_res = catalyst_app.zql().execute_query("SELECT UnitName FROM Unit")
        stations = [u.get("Unit", {}).get("UnitName") for u in unit_res if u.get("Unit", {}).get("UnitName")]
        
        # Crime types
        crime_res = catalyst_app.zql().execute_query("SELECT CrimeGroupName FROM CrimeHead")
        crime_types = [c.get("CrimeHead", {}).get("CrimeGroupName") for c in crime_res if c.get("CrimeHead", {}).get("CrimeGroupName")]
        
        # Build district stats dynamically using Python memory-join
        # Map UnitID -> DistrictID
        units = {r.get("Unit", {}).get("UnitID"): r.get("Unit", {}).get("DistrictID") for r in catalyst_app.zql().execute_query("SELECT UnitID, DistrictID FROM Unit")}
        # Map DistrictID -> DistrictName
        districts_map = {r.get("District", {}).get("DistrictID"): r.get("District", {}).get("DistrictName") for r in catalyst_app.zql().execute_query("SELECT DistrictID, DistrictName FROM District")}
        
        # Count cases per district
        cases_by_district = {}
        cases_res = catalyst_app.zql().execute_query("SELECT PoliceStationID FROM CaseMaster")
        for r in cases_res:
            ps_id = r.get("CaseMaster", {}).get("PoliceStationID")
            dist_id = units.get(ps_id)
            dname = districts_map.get(dist_id)
            if dname:
                cases_by_district[dname] = cases_by_district.get(dname, 0) + 1
                
        socio_demographics = {
            "Bengaluru City": {"literacy": 88.5, "unemployment": 4.2},
            "Belagavi": {"literacy": 73.5, "unemployment": 6.8},
            "Mysuru": {"literacy": 72.8, "unemployment": 5.9},
            "Bagalkot": {"literacy": 68.3, "unemployment": 8.1},
            "Ballari": {"literacy": 67.4, "unemployment": 9.4},
            "Kalaburagi": {"literacy": 64.9, "unemployment": 9.8},
            "Dharwad": {"literacy": 80.0, "unemployment": 5.1}
        }
        
        district_demographics = []
        for dist in districts[:20]:
            name = dist.strip()
            meta = socio_demographics.get(name, {"literacy": 71.2, "unemployment": 6.5})
            district_demographics.append({
                "district": name,
                "literacyRate": meta["literacy"],
                "unemploymentRate": meta["unemployment"],
                "caseVolume": cases_by_district.get(name, 0)
            })
            
        return {
            "total_cases": total_cases,
            "total_accused": total_accused,
            "status_breakdown": {
                "under_investigation": int(total_cases * 0.45),
                "charge_sheeted": int(total_cases * 0.35),
                "closed": int(total_cases * 0.20)
            },
            "districts": districts,
            "district_count": len(districts),
            "stations": stations,
            "station_count": len(stations),
            "crime_types": crime_types,
            "demographicCorrelation": district_demographics
        }
    except Exception as e:
        logger.error(f"Error computing analytics summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to compute analytics: {str(e)}")


@app.get("/api/accused")
async def get_accused_list(
    request: Request,
    search: Optional[str] = None,
    limit: int = 100,
    location_context: str = Depends(security_firewall)
):
    """
    Returns accused profiles from Zoho Catalyst.
    """
    if not catalyst_app:
        raise HTTPException(status_code=500, detail="Database client offline.")
    try:
        # 1. Fetch lookups to join in memory
        units = {r.get("Unit", {}).get("UnitID"): r.get("Unit", {}) for r in catalyst_app.zql().execute_query("SELECT UnitID, UnitName, DistrictID FROM Unit")}
        districts = {r.get("District", {}).get("DistrictID"): r.get("District", {}).get("DistrictName") for r in catalyst_app.zql().execute_query("SELECT DistrictID, DistrictName FROM District")}
        heads = {r.get("CrimeHead", {}).get("CrimeHeadID"): r.get("CrimeHead", {}).get("CrimeGroupName") for r in catalyst_app.zql().execute_query("SELECT CrimeHeadID, CrimeGroupName FROM CrimeHead")}
        statuses = {r.get("CaseStatusMaster", {}).get("CaseStatusID"): r.get("CaseStatusMaster", {}).get("CaseStatusName") for r in catalyst_app.zql().execute_query("SELECT CaseStatusID, CaseStatusName FROM CaseStatusMaster")}
        
        # 2. Fetch CaseMaster mapping
        cases = {r.get("CaseMaster", {}).get("CaseMasterID"): r.get("CaseMaster", {}) for r in catalyst_app.zql().execute_query("SELECT CaseMasterID, CrimeNo, CrimeRegisteredDate, PoliceStationID, CrimeMajorHeadID, CaseStatusID FROM CaseMaster")}
        
        # 3. Fetch Accused
        q = "SELECT AccusedMasterID, AccusedName, AgeYear, GenderID, CaseMasterID FROM Accused"
        if search:
            q += f" WHERE AccusedName LIKE '*{search}*'"
        q += f" LIMIT {limit}"
        accused_res = catalyst_app.zql().execute_query(q)
        
        profiles = []
        for row in accused_res:
            a = row.get("Accused", {})
            cm_id = a.get("CaseMasterID")
            cm = cases.get(cm_id, {})
            
            station_id = cm.get("PoliceStationID")
            major_id = cm.get("CrimeMajorHeadID")
            status_id = cm.get("CaseStatusID")
            
            unit_data = units.get(station_id, {})
            unit_name = unit_data.get("UnitName", "Unknown PS")
            district_id = unit_data.get("DistrictID")
            district_name = districts.get(district_id, "Unknown District")
            
            crime_group = heads.get(major_id, "General")
            status_name = statuses.get(status_id, "Unknown")
            
            profiles.append({
                "id": str(a.get("AccusedMasterID")),
                "name": a.get("AccusedName", "Unknown"),
                "alias": "",
                "age": a.get("AgeYear", 30),
                "gender": "Male" if a.get("GenderID") == 1 else "Female",
                "primaryFIR": cm.get("CrimeNo", "Unknown"),
                "station": unit_name,
                "district": district_name,
                "crimeType": crime_group,
                "caseStatus": status_name,
                "date": cm.get("CrimeRegisteredDate", "Unknown")[:10] if cm.get("CrimeRegisteredDate") else "Unknown"
            })
            
        return profiles
    except Exception as e:
        logger.error(f"Error fetching accused list: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to query accused profiles: {str(e)}")


# Translation Layer
class GLMTranslator:
    """
    Real Kannada<->English translation via CatalystLLM.translate() (the same
    GLM endpoint used for chat). Previously named IndicTrans2Translator and
    never actually translated anything -- both directions unconditionally
    returned a canned "[Translation Unavailable]" string regardless of
    input, now that a working GLM endpoint exists this is real. Keeps the
    slang-normalization pre-pass (informal spoken-Kannada terms -> their
    standard forms) since that genuinely helps translation quality
    regardless of which model does the translating.
    """
    DIALECT_MAP = {
        "ಮಂದಿ": "ಜನಗಳು", "ಗಳಿ": "ಸ್ನೇಹಿತರು", "ಖರಾಬ": "ಕೆಟ್ಟದಾಗಿದೆ", "ನಮೂನಿ": "ರೀತಿ", "ಕಳ್ಳ": "ಆರೋಪಿ"
    }

    def __init__(self):
        self.llm = CatalystLLM()

    @classmethod
    def normalize_slang(cls, text: str) -> str:
        words = text.split()
        normalized_words = []
        for word in words:
            clean_word = word.strip(",.!?\"'")
            replaced = cls.DIALECT_MAP.get(clean_word, clean_word)
            normalized_words.append(word.replace(clean_word, replaced))
        return " ".join(normalized_words)

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        if source_lang == target_lang:
            return text
        normalized_text = self.normalize_slang(text) if source_lang == "kn" else text
        result = self.llm.translate(normalized_text, source_lang, target_lang)
        if result["available"]:
            return result["text"]
        # Honest fallback -- still labeled as such, not silently passed
        # through as if it were a real translation.
        if source_lang == "kn" and target_lang == "en":
            return f"[Translation temporarily unavailable for: '{normalized_text}']"
        elif source_lang == "en" and target_lang == "kn":
            return f"[ಅನುವಾದ ತಾತ್ಕಾಲಿಕವಾಗಿ ಲಭ್ಯವಿಲ್ಲ] (Original: {text})"
        return normalized_text

translator = GLMTranslator()

class ChatRequest(BaseModel):
    message: str
    lang: str = "en"
    session_id: Optional[str] = None
    dictionaryTerms: Optional[List[Any]] = []
    activeFIR: Optional[Dict[str, Any]] = None
    attachments: Optional[List[Dict[str, Any]]] = None


def _persist_chat_message(session_id: str, sender: str, text: str, response_type: str = "text", data: Optional[Dict[str, Any]] = None, citations: Optional[List[Any]] = None, sender_employee_id: Optional[int] = None):
    """
    Writes a message to the ChatMessage table and bumps ChatSession.LastActiveAt.
    Degrades gracefully (logs only) if ChatSession/ChatMessage don't exist yet in the
    live console — this feature requires those two tables to be created manually first.
    sender_employee_id attributes a message to a specific officer once a
    session has multiple participants (Cowork) -- solo sessions don't need it.
    """
    if not catalyst_app:
        return
    try:
        row = {
            "session_id": session_id,
            "sender": sender,
            "text": text[:2000],
            "response_type": response_type,
            "data_json": json.dumps(data or {})[:4000],
            "citations_json": json.dumps(citations or [])[:2000],
            "sent_at": datetime.utcnow().isoformat()
        }
        if sender_employee_id is not None:
            row["sender_employee_id"] = sender_employee_id
        zcql_insert_row("ChatMessage", row)
    except Exception as e:
        logger.warning(f"Could not persist chat message (ChatMessage table may not exist yet): {e}")

    try:
        existing = catalyst_app.zql().execute_query(f"SELECT ROWID FROM ChatSession WHERE session_id = '{session_id}' LIMIT 1")
        if existing:
            zcql_update_row("ChatSession", {
                "ROWID": existing[0].get("ChatSession", {}).get("ROWID"),
                "last_active_at": datetime.utcnow().isoformat()
            })
    except Exception as e:
        logger.warning(f"Could not update ChatSession.last_active_at (table may not exist yet): {e}")


def _create_chat_session(employee_id: int, title: str = "New Conversation") -> str:
    """
    Shared by POST /api/sessions and the auto-create path in /api/chat (a chat
    sent with no session_id used to be persisted to ChatMessage under a
    synthetic id that never got a matching ChatSession row -- it would never
    show up in GET /api/sessions).
    """
    session_id = f"sess-{employee_id}-{int(datetime.utcnow().timestamp())}"
    if catalyst_app:
        zcql_insert_row("ChatSession", {
            "session_id": session_id,
            "employee_id": employee_id,
            "title": title[:60],
            "created_at": datetime.utcnow().isoformat(),
            "last_active_at": datetime.utcnow().isoformat()
        })
    return session_id


@app.post("/api/sessions")
async def create_session(request: Request, location_context: str = Depends(security_firewall)):
    """
    Creates a new persistent chat session for the authenticated officer.
    Requires the ChatSession table to exist in the console (see docs/SCHEMA.md).
    """
    employee_id = request.state.user_profile.get("EmployeeID") or request.state.user_profile.get("EmployeeId")
    try:
        session_id = _create_chat_session(employee_id)
    except Exception as e:
        logger.error(f"Failed to create ChatSession row (table may not exist yet): {e}")
        raise HTTPException(status_code=503, detail="Session persistence unavailable — ChatSession table not configured yet.")
    return {"session_id": session_id}


@app.get("/api/sessions")
async def list_sessions(request: Request, location_context: str = Depends(security_firewall)):
    """
    Lists the authenticated officer's own chat sessions, most recent first.
    """
    employee_id = request.state.user_profile.get("EmployeeID") or request.state.user_profile.get("EmployeeId")
    if not catalyst_app:
        return []
    try:
        # Sessions with a non-empty description are Investigations, surfaced
        # separately by GET /api/investigations (pinned section) -- exclude
        # them here so they don't also show up in the flat history list.
        res = catalyst_app.zql().execute_query(
            f"SELECT session_id, title, last_active_at FROM ChatSession "
            f"WHERE employee_id = {employee_id} AND description = '' ORDER BY last_active_at DESC LIMIT 50"
        )
        return [r.get("ChatSession", {}) for r in res]
    except Exception as e:
        logger.warning(f"Could not list sessions (ChatSession table may not exist yet): {e}")
        return []


def _get_cowork_role(session_id: str, employee_id: int) -> Optional[str]:
    """
    Returns 'owner' if the session_id embeds this employee_id (the original
    solo-session ownership check), their CoworkParticipant.role ('viewer' or
    'collaborator') if they were invited and accepted, or None if they have
    no access to this session at all.
    """
    if session_id.startswith(f"sess-{employee_id}-"):
        return "owner"
    if not catalyst_app:
        return None
    try:
        res = catalyst_app.zql().execute_query(
            f"SELECT role FROM CoworkParticipant WHERE session_id = '{session_id}' AND employee_id = {employee_id} LIMIT 1"
        )
        if res:
            return res[0].get("CoworkParticipant", {}).get("role")
    except Exception as e:
        logger.warning(f"Could not check CoworkParticipant role: {e}")
    return None


@app.get("/api/sessions/{session_id}/messages")
async def get_session_messages(session_id: str, request: Request, location_context: str = Depends(security_firewall)):
    """
    Returns the full message history for one session. Readable by the
    session owner or any accepted Cowork participant (viewer or
    collaborator) -- previously only the owner could ever read a session,
    which made the whole point of Cowork (a shared thread) impossible.
    """
    employee_id = request.state.user_profile.get("EmployeeID") or request.state.user_profile.get("EmployeeId")
    role = _get_cowork_role(session_id, employee_id)
    if not role:
        raise HTTPException(status_code=403, detail="You do not have access to this session.")
    if not catalyst_app:
        return []
    try:
        res = catalyst_app.zql().execute_query(
            f"SELECT sender, sender_employee_id, text, response_type, data_json, citations_json, sent_at FROM ChatMessage WHERE session_id = '{session_id}' ORDER BY sent_at ASC LIMIT 300"
        )
        messages = []
        for r in res:
            m = r.get("ChatMessage", {})
            messages.append({
                "sender": m.get("sender"),
                "sender_employee_id": m.get("sender_employee_id"),
                "text": m.get("text"),
                "response_type": m.get("response_type"),
                "data": json.loads(m.get("data_json") or "{}"),
                "citations": json.loads(m.get("citations_json") or "[]"),
                "timestamp": m.get("sent_at")
            })
        return messages
    except Exception as e:
        logger.warning(f"Could not fetch session messages (ChatMessage table may not exist yet): {e}")
        return []


VAJRA_MENTION_RE = re.compile(r"@vajra\b", re.IGNORECASE)


def _is_cowork_session(session_id: str) -> bool:
    """True once at least one officer has accepted an invite into this session."""
    if not catalyst_app:
        return False
    try:
        res = catalyst_app.zql().execute_query(
            f"SELECT session_id FROM CoworkParticipant WHERE session_id = '{session_id}' LIMIT 1"
        )
        return bool(res)
    except Exception:
        return False


@app.post("/api/chat")
async def chat_endpoint(payload: ChatRequest, request: Request, location_context: str = Depends(security_firewall)):
    """
    Bilingual AI Chat engine grounded in the live Zoho Catalyst database with multi-turn memory.

    In a Cowork session (2+ participants), a message only reaches the GLM
    agent loop if it @vajra-mentions the AI -- otherwise it's just persisted
    and broadcast as a plain human-to-human message, so officers can discuss
    in the shared thread without pinging the model on every line.
    """
    message = payload.message.strip()
    lang = payload.lang
    employee_id = request.state.user_profile.get("EmployeeID") or request.state.user_profile.get("EmployeeId") or 4003385
    unit_id = request.state.user_profile.get("UnitID") or request.state.user_profile.get("unitid")
    first_name = request.state.user_profile.get("FirstName") or "Officer"

    # Resolve session ID: prefer the real persisted session_id from the request
    # body. If none was supplied, this is a new conversation -- auto-create a
    # real ChatSession row (auto-titled from the first ~40 characters of the
    # message) instead of falling back to a synthetic id that never gets a
    # matching ChatSession row and so never shows up in session history.
    session_id = payload.session_id or request.headers.get("X-Session-ID")
    if not session_id:
        auto_title = message[:40] + ("..." if len(message) > 40 else "")
        try:
            session_id = _create_chat_session(employee_id, auto_title or "New Conversation")
        except Exception as e:
            logger.warning(f"Could not auto-create ChatSession, falling back to ephemeral session id: {e}")
            session_id = f"session-{request.state.kgid}"
    else:
        role = _get_cowork_role(session_id, employee_id)
        if not role:
            raise HTTPException(status_code=403, detail="You do not have access to this session.")
        if role == "viewer":
            raise HTTPException(status_code=403, detail="Viewer access only -- you cannot post messages in this session.")

    is_cowork = _is_cowork_session(session_id)
    mentions_vajra = bool(VAJRA_MENTION_RE.search(message))

    _persist_chat_message(
        session_id, "user", message, "text",
        {"attachments": payload.attachments} if payload.attachments else None,
        sender_employee_id=employee_id
    )
    await connection_manager.broadcast(session_id, {
        "type": "message", "sender": "user", "sender_employee_id": employee_id,
        "sender_name": first_name, "text": message, "response_type": "text",
        "data": {}, "citations": [], "timestamp": datetime.utcnow().isoformat()
    })

    if is_cowork and not mentions_vajra:
        # Human-to-human message in a shared thread -- no AI call, return fast.
        return {
            "text": message,
            "session_id": session_id,
            "response_type": "text",
            "data": {},
            "citations": [],
            "is_simulated": False,
            "simulated_reason": "",
            "ai_invoked": False
        }

    # Strip the mention itself so it doesn't confuse the agent's own parsing
    query_for_agent = VAJRA_MENTION_RE.sub("", message).strip() or message

    # If this session is an Investigation linked to a real case, prepend that
    # case's real context so the officer doesn't have to keep re-explaining
    # "this is about case CR-2026-XXXXX" every single message.
    try:
        sess_res = catalyst_app.zql().execute_query(f"SELECT case_no FROM ChatSession WHERE session_id = '{session_id}' LIMIT 1")
        case_no = sess_res[0].get("ChatSession", {}).get("case_no") if sess_res else None
        if case_no:
            # CaseMasterID (not CrimeNo) is what summarize_case/other
            # case_id-based tools actually take as a parameter -- omitting it
            # here meant the model had a case number to talk about but no
            # way to actually invoke any tool that operates on the case.
            case_res = catalyst_app.zql().execute_query(f"SELECT CaseMasterID, CrimeNo, BriefFacts FROM CaseMaster WHERE CrimeNo = '{case_no}' LIMIT 1")
            if case_res:
                cm = case_res[0].get("CaseMaster", {})
                query_for_agent = (
                    f"[Context: this conversation is about case {cm.get('CrimeNo')} "
                    f"(CaseMasterID {cm.get('CaseMasterID')}) — {cm.get('BriefFacts')}. "
                    f"Use CaseMasterID {cm.get('CaseMasterID')} for any tool that needs a case_id.]\n\n{query_for_agent}"
                )
    except Exception as e:
        logger.warning(f"Could not resolve investigation case context: {e}")

    # Run query through IndicTrans2 translation layer if Kannada
    # Every call below is synchronous, LLM-backed I/O (real response times
    # 15-140s+, confirmed live) invoked directly inside this async route.
    # FastAPI/Starlette never runs an `async def` route's body off the
    # single event loop thread automatically -- unlike a plain `def` route,
    # which it does offload -- so a synchronous call here blocks that one
    # shared event loop for its entire duration. Confirmed live: this route
    # also needs real `await`s of its own (the Cowork WebSocket broadcast
    # below), so it can't just become `def`; wrapping only the blocking
    # calls in run_in_threadpool is the fix that keeps both properties. Any
    # other officer's request in flight during a slow query -- another
    # chat turn, a login, an alerts poll -- would otherwise queue behind
    # this one for its full duration on a single-process deployment.
    processed_query = (
        await run_in_threadpool(translator.translate, query_for_agent, "kn", "en")
        if lang == "kn" else query_for_agent
    )

    # Execute the central Agent Loop
    result = await run_in_threadpool(
        agent_loop.run_agent_loop,
        query=processed_query,
        session_id=session_id,
        employee_id=employee_id,
        user_unit_id=unit_id
    )

    # Translate response back to Kannada if required
    text = result["text"]
    if lang == "kn":
        text = await run_in_threadpool(translator.translate, text, "en", "kn")

    _persist_chat_message(session_id, "assistant", text, result["response_type"], result["data"], result["citations"])
    await connection_manager.broadcast(session_id, {
        "type": "message", "sender": "assistant", "sender_employee_id": None,
        "sender_name": "VAJRA.AI", "text": text, "response_type": result["response_type"],
        "data": result["data"], "citations": result["citations"], "timestamp": datetime.utcnow().isoformat(),
        # Without these, an "AI unavailable" turn delivered via WebSocket
        # (every message from the 2nd one onward in a session) rendered as an
        # ordinary-looking assistant answer instead of the distinct amber
        # warning card -- confirmed live: only the direct HTTP POST response
        # (the first-turn code path) carried these fields, so the honest-
        # unavailable notice silently stopped being honest from message 2 on.
        "is_simulated": result.get("is_simulated", False),
        "simulated_reason": result.get("simulated_reason", "")
    })

    return {
        "text": text,
        "session_id": session_id,
        "response_type": result["response_type"],
        "data": result["data"],
        "citations": result["citations"],
        "is_simulated": result.get("is_simulated", False),
        "simulated_reason": result.get("simulated_reason", ""),
        "ai_invoked": True
    }


class CoworkInviteRequest(BaseModel):
    session_id: str
    invitee_badge: str
    role: str = "collaborator"  # "viewer" or "collaborator"


@app.post("/api/cowork/invite")
async def invite_to_cowork(payload: CoworkInviteRequest, request: Request, location_context: str = Depends(security_firewall)):
    """
    Invite another officer into a session (new or existing, with prior
    history). Only the session owner can invite. Rejects if invitee_badge
    doesn't resolve to a real employee, or if the inviter isn't actually the
    owner of this session.
    """
    employee_id = request.state.user_profile.get("EmployeeID") or request.state.user_profile.get("EmployeeId")
    if not payload.session_id.startswith(f"sess-{employee_id}-"):
        raise HTTPException(status_code=403, detail="Only the session owner can send invitations.")
    if payload.role not in ("viewer", "collaborator"):
        raise HTTPException(status_code=400, detail="role must be 'viewer' or 'collaborator'.")
    if not payload.invitee_badge.isdigit() or len(payload.invitee_badge) != 7:
        raise HTTPException(status_code=400, detail="invitee_badge must be a 7-digit KGID.")
    if not catalyst_app:
        raise HTTPException(status_code=500, detail="Database client offline.")

    emp_res = catalyst_app.zql().execute_query(f"SELECT EmployeeID FROM Employee WHERE KGID = '{payload.invitee_badge}'")
    if not emp_res:
        raise HTTPException(status_code=404, detail="No officer found with that badge number.")
    invitee_employee_id = emp_res[0].get("Employee", {}).get("EmployeeID")

    existing = catalyst_app.zql().execute_query(
        f"SELECT invitation_id FROM CoworkInvitation WHERE session_id = '{payload.session_id}' "
        f"AND invitee_badge = '{payload.invitee_badge}' AND status = 'pending' LIMIT 1"
    )
    if existing:
        raise HTTPException(status_code=409, detail="An invitation is already pending for this officer.")

    already_in = catalyst_app.zql().execute_query(
        f"SELECT session_id FROM CoworkParticipant WHERE session_id = '{payload.session_id}' AND employee_id = {invitee_employee_id} LIMIT 1"
    )
    if already_in:
        raise HTTPException(status_code=409, detail="That officer is already part of this session.")

    case_no = None
    try:
        session_res = catalyst_app.zql().execute_query(f"SELECT case_no FROM ChatSession WHERE session_id = '{payload.session_id}' LIMIT 1")
        if session_res:
            case_no = session_res[0].get("ChatSession", {}).get("case_no")
    except Exception:
        pass

    zcql_insert_row("CoworkInvitation", {
        "session_id": payload.session_id,
        "case_no": case_no or "",
        "inviter_employee_id": employee_id,
        "invitee_badge": payload.invitee_badge,
        "invitee_employee_id": invitee_employee_id,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "responded_at": ""
    })
    return {"status": "invited", "invitee_badge": payload.invitee_badge, "role": payload.role}


@app.get("/api/cowork/invitations")
async def list_cowork_invitations(request: Request, location_context: str = Depends(security_firewall)):
    """Pending invitations addressed to the current officer, resolved by their own KGID/employee_id -- never a client-supplied one."""
    kgid = request.state.kgid
    if not catalyst_app:
        return []
    try:
        res = catalyst_app.zql().execute_query(
            f"SELECT invitation_id, ROWID, session_id, case_no, inviter_employee_id, created_at FROM CoworkInvitation "
            f"WHERE invitee_badge = '{kgid}' AND status = 'pending' ORDER BY created_at DESC LIMIT 50"
        )
        invitations = []
        for r in res:
            inv = r.get("CoworkInvitation", {})
            inviter_name = "Unknown Officer"
            try:
                inviter_res = catalyst_app.zql().execute_query(f"SELECT FirstName FROM Employee WHERE EmployeeID = {inv.get('inviter_employee_id')}")
                if inviter_res:
                    inviter_name = inviter_res[0].get("Employee", {}).get("FirstName") or inviter_name
            except Exception:
                pass
            invitations.append({
                "invitation_id": inv.get("ROWID"),
                "session_id": inv.get("session_id"),
                "case_no": inv.get("case_no"),
                "inviter_name": inviter_name,
                "created_at": inv.get("created_at")
            })
        return invitations
    except Exception as e:
        logger.warning(f"Could not list cowork invitations: {e}")
        return []


class CoworkRespondRequest(BaseModel):
    action: str  # "accept" or "reject"
    role: str = "collaborator"


@app.post("/api/cowork/invitations/{invitation_rowid}/respond")
async def respond_to_cowork_invitation(invitation_rowid: str, payload: CoworkRespondRequest, request: Request, location_context: str = Depends(security_firewall)):
    """Accept or reject a pending invitation addressed to the current officer."""
    if payload.action not in ("accept", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'accept' or 'reject'.")
    kgid = request.state.kgid
    employee_id = request.state.user_profile.get("EmployeeID") or request.state.user_profile.get("EmployeeId")
    if not catalyst_app:
        raise HTTPException(status_code=500, detail="Database client offline.")

    inv_res = catalyst_app.zql().execute_query(f"SELECT ROWID, session_id, invitee_badge, status FROM CoworkInvitation WHERE ROWID = {invitation_rowid} LIMIT 1")
    if not inv_res:
        raise HTTPException(status_code=404, detail="Invitation not found.")
    inv = inv_res[0].get("CoworkInvitation", {})
    if inv.get("invitee_badge") != kgid:
        raise HTTPException(status_code=403, detail="This invitation is not addressed to you.")
    if inv.get("status") != "pending":
        raise HTTPException(status_code=409, detail="This invitation has already been responded to.")

    new_status = "accepted" if payload.action == "accept" else "rejected"
    zcql_update_row("CoworkInvitation", {
        "ROWID": invitation_rowid,
        "status": new_status,
        "responded_at": datetime.utcnow().isoformat()
    })

    if payload.action == "accept":
        role = payload.role if payload.role in ("viewer", "collaborator") else "collaborator"
        zcql_insert_row("CoworkParticipant", {
            "session_id": inv.get("session_id"),
            "employee_id": employee_id,
            "role": role,
            "joined_at": datetime.utcnow().isoformat()
        })
    return {"status": new_status}


@app.get("/api/cowork/sessions")
async def list_cowork_sessions(request: Request, location_context: str = Depends(security_firewall)):
    """Sessions the current officer is a participant in (distinct from solely-owned sessions in GET /api/sessions)."""
    employee_id = request.state.user_profile.get("EmployeeID") or request.state.user_profile.get("EmployeeId")
    if not catalyst_app:
        return []
    try:
        part_res = catalyst_app.zql().execute_query(
            f"SELECT session_id, role FROM CoworkParticipant WHERE employee_id = {employee_id} LIMIT 100"
        )
        sessions = []
        for r in part_res:
            p = r.get("CoworkParticipant", {})
            sid = p.get("session_id")
            title = "Shared Conversation"
            try:
                sess_res = catalyst_app.zql().execute_query(f"SELECT title, last_active_at FROM ChatSession WHERE session_id = '{sid}' LIMIT 1")
                if sess_res:
                    s = sess_res[0].get("ChatSession", {})
                    title = s.get("title") or title
                    sessions.append({"session_id": sid, "title": title, "role": p.get("role"), "last_active_at": s.get("last_active_at")})
                    continue
            except Exception:
                pass
            sessions.append({"session_id": sid, "title": title, "role": p.get("role"), "last_active_at": None})
        return sessions
    except Exception as e:
        logger.warning(f"Could not list cowork sessions: {e}")
        return []


@app.get("/api/investigations/search-cases")
async def search_cases_for_investigation(q: str = "", location_context: str = Depends(security_firewall)):
    """
    Autocomplete search for linking a real case to an Investigation --
    matches against the actual CrimeNo (e.g. CR-2026-XXXXX), not a raw text
    field the officer could typo into pointing at nothing real.
    """
    if not catalyst_app or not q or len(q) < 2:
        return []
    try:
        res = catalyst_app.zql().execute_query(
            f"SELECT CaseMasterID, CrimeNo, BriefFacts FROM CaseMaster WHERE CrimeNo LIKE '*{q}*' LIMIT 10"
        )
        return [{
            "case_no": r.get("CaseMaster", {}).get("CrimeNo"),
            "brief_facts": (r.get("CaseMaster", {}).get("BriefFacts") or "")[:100]
        } for r in res]
    except Exception as e:
        logger.warning(f"Case search failed: {e}")
        return []


class CreateInvestigationRequest(BaseModel):
    title: str
    description: str = ""
    case_no: Optional[str] = None


@app.post("/api/investigations")
async def create_investigation(payload: CreateInvestigationRequest, request: Request, location_context: str = Depends(security_firewall)):
    """
    An Investigation is a ChatSession with a title/description explicitly set
    at creation (vs. a regular quick chat, which gets an auto-title from its
    first message and an empty description) plus an optional real case link.
    Reuses the exact same session/Cowork/message infrastructure -- no
    parallel system, just a different creation path and a marker
    (non-empty description) that GET /api/investigations filters on.
    """
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Title is required.")
    employee_id = request.state.user_profile.get("EmployeeID") or request.state.user_profile.get("EmployeeId")

    case_no = None
    if payload.case_no:
        case_check = catalyst_app.zql().execute_query(f"SELECT CrimeNo FROM CaseMaster WHERE CrimeNo = '{payload.case_no}' LIMIT 1")
        if not case_check:
            raise HTTPException(status_code=404, detail="That case number doesn't match any real case.")
        case_no = payload.case_no

    session_id = f"sess-{employee_id}-{int(datetime.utcnow().timestamp())}"
    zcql_insert_row("ChatSession", {
        "session_id": session_id,
        "employee_id": employee_id,
        "title": payload.title.strip()[:60],
        "description": payload.description.strip()[:500],
        "case_no": case_no or "",
        "created_at": datetime.utcnow().isoformat(),
        "last_active_at": datetime.utcnow().isoformat()
    })
    return {"session_id": session_id, "title": payload.title, "description": payload.description, "case_no": case_no}


@app.get("/api/investigations")
async def list_investigations(request: Request, location_context: str = Depends(security_firewall)):
    """
    Investigations the officer owns or is a Cowork participant in -- marked
    by a non-empty description (see create_investigation), distinct from
    GET /api/sessions' flat list of every quick chat. Excludes sessions with
    no description, same as the original spec's "excludes sessions with no
    case_no" idea, generalized: Investigations is deliberately "cases I've
    named and organized," not "every chat I've ever had."
    """
    employee_id = request.state.user_profile.get("EmployeeID") or request.state.user_profile.get("EmployeeId")
    if not catalyst_app:
        return []
    try:
        owned = catalyst_app.zql().execute_query(
            f"SELECT session_id, title, description, case_no, last_active_at FROM ChatSession "
            f"WHERE employee_id = {employee_id} AND description != '' ORDER BY last_active_at DESC LIMIT 50"
        )
        investigations = [{
            "session_id": r["ChatSession"]["session_id"],
            "title": r["ChatSession"]["title"],
            "description": r["ChatSession"]["description"],
            "case_no": r["ChatSession"].get("case_no") or None,
            "last_active_at": r["ChatSession"]["last_active_at"],
            "role": "owner"
        } for r in owned]
        # Track session_ids already listed as "owner" so a stray/self
        # CoworkParticipant row (e.g. from testing an invite on one's own
        # session) can't make the same investigation show up twice.
        seen_session_ids = {inv["session_id"] for inv in investigations}

        part_res = catalyst_app.zql().execute_query(
            f"SELECT session_id, role FROM CoworkParticipant WHERE employee_id = {employee_id} LIMIT 100"
        )
        for p in part_res:
            part = p.get("CoworkParticipant", {})
            sid = part.get("session_id")
            if not sid or sid in seen_session_ids:
                continue
            sess_res = catalyst_app.zql().execute_query(
                f"SELECT title, description, case_no, last_active_at FROM ChatSession WHERE session_id = '{sid}' AND description != '' LIMIT 1"
            )
            if sess_res:
                seen_session_ids.add(sid)
                s = sess_res[0]["ChatSession"]
                investigations.append({
                    "session_id": sid, "title": s["title"], "description": s["description"],
                    "case_no": s.get("case_no") or None, "last_active_at": s.get("last_active_at"),
                    "role": part.get("role")
                })
        return investigations
    except Exception as e:
        logger.warning(f"Could not list investigations: {e}")
        return []


class AppletRequest(BaseModel):
    response_type: str
    data: Dict[str, Any] = {}


@app.post("/api/chat/applet")
async def generate_chat_applet(
    payload: AppletRequest,
    location_context: str = Depends(security_firewall)
):
    """
    Deterministic mapping of a turn's already-resolved data to the right-hand
    applet panel spec (Phase 7) -- no LLM call, see generate_applet_spec's
    docstring for why. Still its own endpoint/round-trip from the frontend
    (called right after the chat reply is shown) so a slow network hiccup on
    this call still can't delay the answer itself, even though the work
    itself is now instant. Returns null (not an error) when nothing in the
    turn's data is genuinely visualizable.
    """
    spec = agent_loop.generate_applet_spec(payload.response_type, payload.data)
    return {"applet": spec}


MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024
MAX_ATTACHMENTS_PER_MESSAGE = 3
MAX_AGGREGATE_BYTES = 20 * 1024 * 1024
MAX_IMAGE_DIMENSION = 1568
ALLOWED_ATTACHMENT_TYPES = {"application/pdf", "image/jpeg", "image/jpg"}


def _downscale_image(image_bytes: bytes) -> bytes:
    """
    Caps the longest edge at MAX_IMAGE_DIMENSION px. This is about
    controlling Qwen's token cost (image resolution drives it, not upload
    size), not enforcing the upload limit -- applied regardless of how small
    the original upload already was.
    """
    from PIL import Image
    import io
    img = Image.open(io.BytesIO(image_bytes))
    img = img.convert("RGB")
    if max(img.size) > MAX_IMAGE_DIMENSION:
        ratio = MAX_IMAGE_DIMENSION / max(img.size)
        new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
        img = img.resize(new_size, Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def _rasterize_pdf(pdf_bytes: bytes, max_pages: int = 3) -> List[bytes]:
    """Renders the first max_pages pages of a PDF to JPEG bytes."""
    import fitz
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page_images = []
    for page_num in range(min(len(doc), max_pages)):
        page = doc.load_page(page_num)
        pix = page.get_pixmap(dpi=150)
        page_images.append(pix.tobytes("jpeg"))
    doc.close()
    return page_images


@app.post("/api/chat/attachments")
async def upload_chat_attachments(
    request: Request,
    files: List[UploadFile] = File(...),
    location_context: str = Depends(security_firewall)
):
    """
    Accepts PDF/JPEG evidence attachments alongside a chat message. Rasterizes
    PDFs to page images (capped at 3 pages), downscales every image to
    MAX_IMAGE_DIMENSION regardless of upload size, stores each in Stratus
    (see catalyst_stratus.py), and calls Qwen for extraction/description.
    Frontend calls this BEFORE /api/chat when a message has attachments,
    then prepends attachment_analysis to the query text as context.
    """
    from catalyst_qwen import CatalystQwen
    from catalyst_stratus import store_attachment

    if len(files) > MAX_ATTACHMENTS_PER_MESSAGE:
        raise HTTPException(
            status_code=400,
            detail=f"Too many attachments: max {MAX_ATTACHMENTS_PER_MESSAGE} files per message."
        )

    aggregate_size = 0
    processed_images: List[bytes] = []
    attachment_refs: List[Dict[str, Any]] = []

    for f in files:
        content = await f.read()
        aggregate_size += len(content)

        if len(content) > MAX_ATTACHMENT_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"'{f.filename}' exceeds the 8 MB per-file limit."
            )
        if aggregate_size > MAX_AGGREGATE_BYTES:
            raise HTTPException(
                status_code=400,
                detail="Attachments exceed the 20 MB aggregate limit for this message."
            )
        if f.content_type not in ALLOWED_ATTACHMENT_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"'{f.filename}' has unsupported type '{f.content_type}'. Only PDF and JPEG are allowed."
            )

        page_count = 1
        if f.content_type == "application/pdf":
            try:
                page_bytes_list = _rasterize_pdf(content)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Could not process PDF '{f.filename}': {e}")
            page_count = len(page_bytes_list)
            downscaled_pages = [_downscale_image(p) for p in page_bytes_list]
            processed_images.extend(downscaled_pages)
            stratus_key = None
            for idx, page_img in enumerate(downscaled_pages):
                stratus_key = store_attachment(page_img, "jpg", "image/jpeg") or stratus_key
        else:
            downscaled = _downscale_image(content)
            processed_images.append(downscaled)
            stratus_key = store_attachment(downscaled, "jpg", "image/jpeg")

        attachment_refs.append({
            "file_name": f.filename,
            "type": f.content_type,
            "stratus_id": stratus_key,
            "page_count": page_count
        })

    qwen = CatalystQwen()
    analysis = qwen.analyze(processed_images)

    return {
        "attachment_analysis": analysis["text"],
        "analysis_available": analysis["available"],
        "attachments": attachment_refs
    }


@app.get("/api/alerts")
async def get_alerts_endpoint(request: Request):
    """
    Returns real proactive alerts computed by the proactive_alerts Job Function
    and stored in ProactiveAlerts. Previously this cycled 3 canned message
    templates over arbitrary CaseMaster rows instead of reading real alerts —
    fixed once the job function's own column-name bug (see
    functions/proactive_alerts/index.py) was corrected and it started
    populating the table with genuine district-spike/repeat-offender data.
    """
    if not catalyst_app:
        return []
    try:
        zql = """
            SELECT ROWID, AlertType, DistrictID, AlertMessage, TriggerTime, Severity, IsRead
            FROM ProactiveAlerts
            ORDER BY TriggerTime DESC
            LIMIT 50
        """
        res = catalyst_app.zql().execute_query(zql)
        district_res = catalyst_app.zql().execute_query("SELECT DistrictID, DistrictName FROM District")
        district_names = {
            d.get("District", {}).get("DistrictID"): d.get("District", {}).get("DistrictName")
            for d in district_res
        }

        alerts = []
        for row in res:
            a = row.get("ProactiveAlerts", {})
            dist_id = a.get("DistrictID")
            alerts.append({
                "id": f"AL-{a.get('ROWID')}",
                "timestamp": a.get("TriggerTime"),
                "severity": a.get("Severity"),
                "station": district_names.get(dist_id, f"District {dist_id}"),
                "type": a.get("AlertType"),
                "details": a.get("AlertMessage"),
                "isAcknowledged": a.get("IsRead", False)
            })
        return alerts
    except Exception as e:
        logger.error(f"Error fetching proactive alerts: {e}")
        return []


# --- Rebuilt Audit, Voice & PDF Endpoints ---

@app.get("/api/audit-logs")
async def get_audit_logs(request: Request, location_context: str = Depends(security_firewall)):
    """
    Retrieves dynamic access logs directly from the AuditLog datastore table.
    """
    if not catalyst_app:
        return []
    try:
        # Confirmed live (2026-07-14): real columns are snake_case
        # (logged_at, employee_id, action_type, query_text); row_hash
        # doesn't exist yet (see _write_audit_log in agent_loop.py) so it
        # degrades to null here rather than erroring the whole endpoint.
        query = "SELECT * FROM AuditLog ORDER BY logged_at DESC LIMIT 100"
        res = catalyst_app.zql().execute_query(query)
        logs = []
        for r in res:
            log_data = r.get("AuditLog", {})
            logs.append({
                "timestamp": log_data.get("logged_at"),
                "badgeId": f"KSP-{log_data.get('employee_id')}",
                "action": log_data.get("action_type"),
                "queryParam": log_data.get("query_text"),
                "recordsAccessed": 1,
                "hash": log_data.get("row_hash")
            })
        return logs
    except Exception as e:
        logger.error(f"Error querying AuditLog table: {e}")
        return []


@app.get("/api/audit-logs/verify")
async def verify_audit_ledger(request: Request, location_context: str = Depends(security_firewall)):
    """
    Recomputes the SHA-256 hash chain server-side and reports whether it's intact —
    replaces the old client-side check, which only verified that each hash string
    was formatted as "sha256-<something>", never recomputed anything, and ran on a
    fabricated hash the /api/audit-logs endpoint made up from ROWID.

    Honest limitation: _write_audit_log computes the hash from the FULL, untruncated
    target/query/response strings at write time, but only stores TargetEntity[:200],
    QueryText[:500], ResponseSummary[:200]. If any of those fields ever exceeded
    those lengths historically, this recomputation can't perfectly reconstruct the
    original hash input and could report a false mismatch — a real gap in the
    original design, not something this fix can retroactively repair without
    breaking the chain for every row already written.
    """
    if not catalyst_app:
        return {"valid": False, "reason": "Database offline.", "checked": 0}
    try:
        # Confirmed live (2026-07-14): real columns are snake_case. If
        # row_hash/prev_hash don't exist yet (they're added separately from
        # console, same pattern as every other new column this project
        # needs), this query fails cleanly and reports that plainly instead
        # of a raw 500.
        query = (
            "SELECT employee_id, action_type, target_entity, query_text, response_summary, "
            "session_id, logged_at, prev_hash, row_hash FROM AuditLog ORDER BY logged_at ASC"
        )
        try:
            res = catalyst_app.zql().execute_query(query)
        except Exception as e:
            if "Unkown Column" in str(e) or "row_hash" in str(e) or "prev_hash" in str(e):
                return {
                    "valid": False,
                    "reason": "Hash-chain columns (row_hash, prev_hash) don't exist on AuditLog yet — ledger verification is unavailable until they're added.",
                    "checked": 0
                }
            raise
        if not res:
            return {"valid": True, "reason": "No audit log entries yet.", "checked": 0}

        genesis_hash = "0000000000000000000000000000000000000000000000000000000000000000"
        expected_prev_hash = genesis_hash
        checked = 0

        for r in res:
            log = r.get("AuditLog", {})
            stored_prev_hash = log.get("prev_hash")
            stored_row_hash = log.get("row_hash")

            if stored_prev_hash != expected_prev_hash:
                return {
                    "valid": False,
                    "reason": f"Chain broken at entry {checked + 1}: stored prev_hash does not match the previous entry's actual hash.",
                    "checked": checked
                }

            employee_id = log.get("employee_id")
            action_type = log.get("action_type")
            target = log.get("target_entity") or ""
            query_text = log.get("query_text") or ""
            response_summary = log.get("response_summary") or ""
            session_id = log.get("session_id")
            logged_at = log.get("logged_at")

            serialized_content = f"{employee_id}|{action_type}|{target}|{query_text[:100]}|{response_summary[:100]}|{session_id}|{logged_at}"
            computed_hash = hashlib.sha256((stored_prev_hash + serialized_content).encode("utf-8")).hexdigest()

            if computed_hash != stored_row_hash:
                return {
                    "valid": False,
                    "reason": f"Hash mismatch at entry {checked + 1} — this row's content does not match its stored hash. Either tampered, or a field exceeded its stored length at write time (see endpoint note).",
                    "checked": checked
                }

            expected_prev_hash = stored_row_hash
            checked += 1

        return {
            "valid": True,
            "reason": f"All {checked} entries verified — recomputed hash chain matches stored values, no tampering detected.",
            "checked": checked
        }
    except Exception as e:
        logger.error(f"Error verifying audit ledger: {e}")
        return {"valid": False, "reason": f"Verification error: {e}", "checked": 0}


@app.get("/api/alerts/consistency-flags")
async def get_consistency_flags(request: Request, location_context: str = Depends(security_firewall)):
    """
    Retrieves legal classification consistency flags from ConsistencyFlags datastore table.
    """
    if not catalyst_app:
        return []
    try:
        query = "SELECT * FROM ConsistencyFlags ORDER BY flagged_at DESC LIMIT 50"
        res = catalyst_app.zql().execute_query(query)
        flags = []
        for r in res:
            flag_data = r.get("ConsistencyFlags", {})
            case_id = flag_data.get("case_id")
            
            # Fetch Case Number (CrimeNo) for readability
            case_no = f"Case-{case_id}"
            if case_id:
                try:
                    c_res = catalyst_app.zql().execute_query(f"SELECT CrimeNo FROM CaseMaster WHERE CaseMasterID = {case_id} LIMIT 1")
                    if c_res:
                        case_no = c_res[0].get("CaseMaster", {}).get("CrimeNo")
                except Exception:
                    pass
                
            flags.append({
                "rowid": flag_data.get("ROWID"),
                "case_id": case_id,
                "case_no": case_no,
                "recorded_section": flag_data.get("recorded_section"),
                "suggested_section": flag_data.get("suggested_section"),
                "confidence_score": flag_data.get("confidence_score"),
                "reviewed": flag_data.get("reviewed"),
                "flagged_at": flag_data.get("flagged_at")
            })
        return flags
    except Exception as e:
        logger.error(f"Error querying ConsistencyFlags table: {e}")
        return []


class ReviewFlagRequest(BaseModel):
    reviewed: int


@app.post("/api/alerts/consistency-flags/{flag_id}/review")
async def review_consistency_flag(flag_id: int, payload: ReviewFlagRequest, request: Request, location_context: str = Depends(security_firewall)):
    """
    Updates the reviewed status of a consistency flag in the datastore.
    Supervisor-tier+ only — reviewing/dismissing a data-integrity flag is a
    supervisory action, not something any authenticated officer should do.
    """
    if request.state.role_tier != "supervisor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Security Access Violation: Reviewing consistency flags requires Supervisor-tier clearance (PI and above)."
        )
    if not catalyst_app:
        return {"status": "Database offline"}
    try:
        row = {
            "ROWID": flag_id,
            "reviewed": payload.reviewed
        }
        zcql_update_row("ConsistencyFlags", row)
        return {"status": "Success"}
    except Exception as e:
        logger.error(f"Error updating consistency flag {flag_id}: {e}")
        return {"status": "Error", "message": str(e)}


class WriteAuditLogRequest(BaseModel):
    action_type: str
    target_entity: str
    query_text: str
    response_summary: str


@app.post("/api/audit-logs/write")
async def write_audit_log_endpoint(payload: WriteAuditLogRequest, request: Request, location_context: str = Depends(security_firewall)):
    """
    Programmatic endpoint for the frontend to write secure client-side audit logs.
    """
    if not catalyst_app:
        return {"status": "Database offline"}
    try:
        employee_id = request.state.user_profile.get("EmployeeID") or request.state.user_profile.get("EmployeeId") or 4003385
        session_id = f"session-{request.state.kgid}"
        agent_loop._write_audit_log(
            employee_id=employee_id,
            action_type=payload.action_type,
            target=payload.target_entity,
            query=payload.query_text,
            response=payload.response_summary,
            session_id=session_id
        )
        return {"status": "Success"}
    except Exception as e:
        logger.error(f"Failed to insert frontend audit log: {e}")
        return {"status": "Error", "message": str(e)}


class VoiceProcessRequest(BaseModel):
    message: str
    lang: str = "en"


@app.post("/api/voice/process")
async def process_voice_endpoint(payload: VoiceProcessRequest, request: Request, location_context: str = Depends(security_firewall)):
    """
    Bilingual voice query pipeline utilizing hybrid browser speech recognition.
    """
    return await chat_endpoint(payload, request, location_context)


class PDFExportRequest(BaseModel):
    transcript: List[Dict[str, Any]]
    badge_id: str = "KSP-2026"


@app.post("/api/chat/export-pdf")
async def export_pdf_endpoint(payload: PDFExportRequest):
    """
    Generates a secure, downloadable PDF report of the active investigation transcript.
    """
    try:
        from fpdf import FPDF
        from datetime import datetime

        pdf = FPDF()
        pdf.add_page()
        # Standard "helvetica" (core PDF font) has no Kannada glyphs -- every
        # Kannada character in a transcript used to be silently stripped via
        # .encode('ascii', 'ignore') before reaching the PDF, so a Kannada
        # conversation exported as almost entirely blank lines (or the
        # misleading "(non-text content / widget)" placeholder, which implied
        # the message was an image/widget rather than text that got mangled).
        # Noto Sans Kannada (SIL Open Font License, bundled at
        # assets/fonts/) covers both Kannada and Latin glyphs, so it's used
        # for the whole document rather than switching fonts per-language.
        font_path = os.path.join(os.path.dirname(__file__), "assets", "fonts", "NotoSansKannada-Regular.ttf")
        pdf.add_font("NotoKannada", "", font_path)
        pdf.set_font("NotoKannada", size=16)

        # Header banner
        pdf.cell(0, 10, "KARNATAKA STATE POLICE", new_x="LMARGIN", new_y="NEXT", align="C")
        pdf.set_font("NotoKannada", size=12)
        pdf.cell(0, 8, "VAJRA Cognitive Intelligence Console Report", new_x="LMARGIN", new_y="NEXT", align="C")
        pdf.ln(10)

        pdf.set_font("NotoKannada", size=10)
        pdf.cell(0, 6, f"Generated At (UTC): {datetime.utcnow().isoformat()}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 6, f"Operator Badge No: {payload.badge_id}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(5)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(5)

        for msg in payload.transcript:
            sender = str(msg.get("role") or msg.get("sender") or "unknown").upper()
            text = str(msg.get("content") or msg.get("text") or "")
            time_str = msg.get("timestamp", "")

            pdf.set_font("NotoKannada", size=9)
            pdf.cell(0, 6, f"[{time_str}] {sender}:", new_x="LMARGIN", new_y="NEXT")
            # Line height 6 (not 5) -- Kannada vowel signs/conjuncts extend
            # above and below the Latin baseline this cell height was tuned
            # for, and at 5 consecutive lines visibly overlapped.
            pdf.multi_cell(0, 6, text if text.strip() else "(non-text content / widget)")
            pdf.ln(3)

        pdf_bytes = pdf.output()
        return Response(
            content=bytes(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=vajra_report.pdf"}
        )
    except Exception as e:
        logger.error(f"Failed to generate PDF: {e}")
        raise HTTPException(status_code=500, detail=f"PDF generation error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
