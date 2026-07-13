import sys
sys.stdout.reconfigure(encoding='utf-8')

with open("vajra_backend/main.py", "r", encoding="utf-8") as f:
    content = f.read()

# Let's find /api/audit-logs
idx = content.find("/api/audit-logs")
if idx != -1:
    print(content[idx-100:idx+1500])
else:
    print("Not found /api/audit-logs")
