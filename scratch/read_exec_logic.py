with open("vajra_backend/agent_loop.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "def _write_audit_log" in line:
        print(f"Found _write_audit_log at line {i+1}")
    if "def run_agent_loop" in line:
        print(f"Found run_agent_loop at line {i+1}")
