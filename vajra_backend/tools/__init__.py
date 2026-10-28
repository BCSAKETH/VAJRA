"""
VAJRA 3.0 Tools Package
Initializes the decoupled ToolManager and imports registered tools.
"""

from tools.registry import ToolManager, VajraTool

# Auto-import foundational tools to register them with ToolManager
import tools.tool_rto_lookup
import tools.tool_threat_score
import tools.tool_cctns_search
import tools.tool_vision_extractor
import tools.tool_syndicate_graph
import tools.tool_portal_scraper
import tools.tool_mo_semantic
import tools.tool_patrol_route
import tools.tool_socio_demographic
