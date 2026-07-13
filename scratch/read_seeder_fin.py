import sys
sys.stdout.reconfigure(encoding='utf-8')

with open("vajra_backend/migrate_to_catalyst.py", "r", encoding="utf-8") as f:
    content = f.read()

# Let's find FinancialTransaction
idx = content.find("FinancialTransaction")
if idx != -1:
    print(content[idx-100:idx+1500])
else:
    print("Not found FinancialTransaction in migrate_to_catalyst.py")
