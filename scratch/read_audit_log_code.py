import sys
sys.stdout.reconfigure(encoding='utf-8')

with open("vajra_backend/agent_loop.py", "r", encoding="utf-8") as f:
    content = f.read()

# Let's find def _write_audit_log
start_idx = content.find("def _write_audit_log")
if start_idx != -1:
    print("Found _write_audit_log:")
    # Print the next 1000 characters
    print(content[start_idx:start_idx+2000])
else:
    print("Not found def _write_audit_log")
