import sys
import os

# All third-party dependencies are pre-installed for Linux/cp312 into
# vendor/ (shipped as part of this deploy's source, not installed at
# runtime) -- Catalyst's Python AppSail runtime disk is hard-capped at
# 1024MB, which this app's real ML dependency footprint (xgboost, shap,
# scipy, pandas, scikit-learn, pymupdf...) doesn't fit inside once
# downloaded and unpacked live. Prepending vendor/ to sys.path means
# `pip install` never has to run inside the constrained runtime container
# at all -- everything needed is already on disk from the archive itself.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "vendor"))
os.execv(sys.executable, [sys.executable, "main.py"])
