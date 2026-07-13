import sys
sys.path.append("vajra_backend")
import logging
from agent_loop import VajraAgentLoop
from vajra_core import catalyst_app

logging.basicConfig(level=logging.INFO)

loop = VajraAgentLoop()
# Simulate a query that calls get_forecast
# We will directly run the tool to test it
print("=== TESTING get_forecast TOOL ===")
result = loop.run_agent_loop(
    query="Get forecast for Indiranagar for CYBERCRIME",
    session_id="test-session-888",
    employee_id=1,
    user_unit_id=6
)
print("Agent Loop Result:")
import json
print(json.dumps(result, indent=2))
