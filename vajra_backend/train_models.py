import os
import logging
import numpy as np
import pandas as pd
from typing import Tuple
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, roc_auc_score
import xgboost as xgb
import shap
import joblib

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# Constants for output paths
DBSCAN_PATH = "dbscan_hotspots.joblib"
XGBOOST_PATH = "xgboost_risk_model.joblib"
SHAP_PATH = "shap_explainer.joblib"
ENCODER_PATH = "label_encoders.joblib"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_INPUT = os.path.join(SCRIPT_DIR, "..", "FIR_Details_Data.csv")

def load_and_preprocess_data(csv_path: str) -> pd.DataFrame:
    """
    Loads raw Karnataka Police FIR data with memory optimization, filters to the
    true Karnataka bounding box, and creates cyclical and engineered features.
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Could not locate main dataset file at '{csv_path}'.")
        
    logger.info(f"Loading data from '{csv_path}' for model training...")
    
    # Read only required columns to conserve memory
    usecols = [
        'District_Name', 'UnitName', 'FIR_YEAR', 'FIR_MONTH', 'FIR_Day', 
        'FIR Type', 'CrimeGroup_Name', 'Latitude', 'Longitude', 
        'VICTIM COUNT', 'Accused Count', 'Conviction Count'
    ]
    
    # Read first 150,000 rows as a representative subset for robust local training
    df = pd.read_csv(csv_path, usecols=usecols, nrows=150000)
    df.rename(columns={'FIR Type': 'FIR_Type'}, inplace=True)
    
    # 1. Clean Coordinates & Apply Karnataka Bounding Box
    df = df[
        (df['Latitude'] >= 11.0) & (df['Latitude'] <= 19.0) &
        (df['Longitude'] >= 73.0) & (df['Longitude'] <= 79.0)
    ].dropna(subset=['District_Name', 'UnitName', 'CrimeGroup_Name'])
    
    logger.info(f"Loaded and cleaned {len(df)} records within geographical bounds.")
    
    # 2. Advanced Feature Engineering
    # Cyclical temporal transformations for Month & Day to capture periodic weekly/annual patterns
    df['month_sin'] = np.sin(2 * np.pi * df['FIR_MONTH'] / 12.0)
    df['month_cos'] = np.cos(2 * np.pi * df['FIR_MONTH'] / 12.0)
    df['day_sin'] = np.sin(2 * np.pi * df['FIR_Day'] / 31.0)
    df['day_cos'] = np.cos(2 * np.pi * df['FIR_Day'] / 31.0)
    
    # Ratios & metrics
    df['victim_to_accused_ratio'] = df['VICTIM COUNT'] / (df['Accused Count'] + 1.0)
    
    # target label: 1 if convicted, 0 otherwise
    df['convicted_target'] = (df['Conviction Count'] > 0).astype(int)
    
    return df

def train_dbscan_hotspots(df: pd.DataFrame) -> DBSCAN:
    """
    Fits DBSCAN on coordinates to identify dense crime hotspots.
    Epsilon=0.005 is roughly 500 meters. Min_samples=10.
    """
    logger.info("Executing spatial hotspot clustering using DBSCAN...")
    coords = df[['Latitude', 'Longitude']].values
    
    dbscan = DBSCAN(eps=0.005, min_samples=10, metric='euclidean')
    dbscan.fit(coords)
    
    unique_labels = set(dbscan.labels_)
    num_clusters = len(unique_labels) - (1 if -1 in unique_labels else 0)
    logger.info(f"DBSCAN complete. Found {num_clusters} high-density spatial crime hotspots.")
    
    joblib.dump(dbscan, DBSCAN_PATH)
    logger.info(f"Serialized DBSCAN model to {DBSCAN_PATH}")
    return dbscan

def train_xgboost_risk(df: pd.DataFrame) -> Tuple[xgb.XGBClassifier, shap.TreeExplainer]:
    """
    Trains a production-grade XGBoost classifier to predict conviction probability (Outcome Risk).
    Handles class imbalance using scale_pos_weight and encodes categoricals.
    """
    logger.info("Encoding categorical variables and preparing train-test splits...")
    
    # Categorical encoders
    categorical_cols = ['District_Name', 'UnitName', 'CrimeGroup_Name', 'FIR_Type']
    label_encoders = {}
    
    for col in categorical_cols:
        le = LabelEncoder()
        df[col + '_encoded'] = le.fit_transform(df[col].astype(str))
        label_encoders[col] = le
        
    joblib.dump(label_encoders, ENCODER_PATH)
    logger.info(f"Label encoders saved to {ENCODER_PATH}")
    
    # Feature set selection
    features = [
        'District_Name_encoded', 'UnitName_encoded', 'CrimeGroup_Name_encoded', 'FIR_Type_encoded',
        'FIR_YEAR', 'month_sin', 'month_cos', 'day_sin', 'day_cos', 
        'VICTIM COUNT', 'Accused Count', 'victim_to_accused_ratio'
    ]
    
    X = df[features]
    y = df['convicted_target']
    
    # Split train/test (80/20)
    split_idx = int(len(df) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
    
    # Compute scale_pos_weight to balance classes
    num_neg = (y_train == 0).sum()
    num_pos = (y_train == 1).sum()
    scale_weight = float(num_neg) / float(num_pos) if num_pos > 0 else 1.0
    logger.info(f"Class counts - Negatives: {num_neg}, Positives: {num_pos}. Computed scale_pos_weight: {scale_weight:.4f}")
    
    logger.info("Training XGBoost Classifier...")
    model = xgb.XGBClassifier(
        n_estimators=150,
        max_depth=6,
        learning_rate=0.08,
        scale_pos_weight=scale_weight,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric='logloss',
        random_state=42
    )
    model.fit(X_train, y_train)
    
    # Evaluate model
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]
    
    roc_auc = roc_auc_score(y_test, y_proba)
    logger.info("XGBoost Validation Metrics:")
    logger.info(f"ROC-AUC Score: {roc_auc:.4f}")
    print(classification_report(y_test, y_pred))
    
    # Save the model
    joblib.dump(model, XGBOOST_PATH)
    logger.info(f"Serialized XGBoost model to {XGBOOST_PATH}")
    
    # Train SHAP TreeExplainer
    logger.info("Generating SHAP TreeExplainer...")
    # Using a sample of background data to keep explanation generation fast
    background_sample = X_train.sample(min(len(X_train), 500), random_state=42)
    explainer = shap.TreeExplainer(model, data=background_sample)
    joblib.dump(explainer, SHAP_PATH)
    logger.info(f"Serialized SHAP TreeExplainer to {SHAP_PATH}")
    
    return model, explainer

if __name__ == "__main__":
    try:
        data = load_and_preprocess_data(CSV_INPUT)
        train_dbscan_hotspots(data)
        train_xgboost_risk(data)
        logger.info("God Pro Max ML training pipeline executed successfully.")
    except Exception as e:
        logger.critical(f"ML Pipeline Failure: {e}")
        exit(1)
