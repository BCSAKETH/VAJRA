import sys
sys.stdout.reconfigure(encoding='utf-8')

with open("vajra_backend/agent_loop.py", "r", encoding="utf-8") as f:
    content = f.read()

# Let's find query_financial_links
idx = content.find("query_financial_links")
if idx != -1:
    print(content[idx:idx+1500])
else:
    print("Not found query_financial_links")
