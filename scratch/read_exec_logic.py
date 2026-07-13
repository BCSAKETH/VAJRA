with open("vajra_backend/main.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if '"/api/audit-logs"' in line or "'/api/audit-logs'" in line:
        print(f"Found /api/audit-logs start at line {i+1}")
        for j in range(i, min(i+25, len(lines))):
            print(f"{j+1}: {lines[j]}", end="")
            
for i, line in enumerate(lines):
    if '"/api/alerts/consistency-flags"' in line or "'/api/alerts/consistency-flags'" in line:
        print(f"\nFound /api/alerts/consistency-flags start at line {i+1}")
        for j in range(i, min(i+35, len(lines))):
            print(f"{j+1}: {lines[j]}", end="")
