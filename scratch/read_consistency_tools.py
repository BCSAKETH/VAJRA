import sys
sys.stdout.reconfigure(encoding='utf-8')

with open("vajra_backend/agent_loop.py", "r", encoding="utf-8") as f:
    content = f.read()

# Let's search for "consistent"
idx = content.lower().find("consistent")
while idx != -1:
    print(f"Found 'consistent' at index {idx}:")
    print(content[max(0, idx-100):idx+300])
    idx = content.lower().find("consistent", idx+1)
