with open("vajra_backend/agent_loop.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "suggest_sections_for_query" in line:
        print(f"Found suggest_sections_for_query reference at line {i+1}: {line.strip()}")
