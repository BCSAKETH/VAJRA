import sys
sys.stdout.reconfigure(encoding='utf-8')

with open("docs/SCHEMA.md", "r", encoding="utf-8") as f:
    content = f.read()

# Let's find AuditLog
start_idx = content.find("### `AuditLog`")
if start_idx != -1:
    print(content[start_idx:start_idx+1000])
else:
    print("Not found ### `AuditLog` in docs/SCHEMA.md")
