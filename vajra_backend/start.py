import subprocess
import sys
import os

# Catalyst's Python AppSail buildpack provisions a bare python3 interpreter
# but does not automatically run `pip install -r requirements.txt` (confirmed
# live: main.py crashed with ModuleNotFoundError on its very first import).
# The "command" in app-config.json is exec'd directly with no shell, so it
# can't be a chained "pip install && python3 main.py" -- this wrapper does
# both steps in a single program invocation instead.
subprocess.check_call([sys.executable, "-m", "pip", "install", "--no-cache-dir", "-r", "requirements.txt"])
os.execv(sys.executable, [sys.executable, "main.py"])
