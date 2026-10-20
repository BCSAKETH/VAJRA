"""
VAJRA 3.0 - MCP Tool Registry & Decoupled Tool Manager
======================================================
Provides an extensible, decoupled architectural pattern for registering, discovering,
and executing investigative and forensic tools for the VAJRA Copilot.
"""

from typing import Dict, Any, Optional
import logging

logger = logging.getLogger("vajra_tools")

class VajraTool:
    """Base class for all decoupled VAJRA tools."""
    def get_schema(self) -> dict:
        raise NotImplementedError("Every VajraTool must declare a schema.")

    def execute(self, params: dict, context: dict) -> dict:
        raise NotImplementedError("Every VajraTool must implement execute().")

class ToolManager:
    """Central registry and execution manager for decoupled tools."""
    _registry: Dict[str, VajraTool] = {}

    @classmethod
    def register(cls, name: str, tool: VajraTool):
        cls._registry[name] = tool
        logger.info(f"[ToolManager] Registered tool: {name}")

    @classmethod
    def is_registered(cls, name: str) -> bool:
        return name in cls._registry

    @classmethod
    def get_tool(cls, name: str) -> Optional[VajraTool]:
        return cls._registry.get(name)

    @classmethod
    def execute_tool(cls, name: str, params: dict, context: dict) -> dict:
        if name in cls._registry:
            try:
                return cls._registry[name].execute(params, context)
            except Exception as e:
                logger.error(f"[ToolManager] Error executing tool '{name}': {e}", exc_info=True)
                return {"error": f"Tool execution error: {str(e)}"}
        return {"error": "Tool not found"}

    @classmethod
    def get_all_schemas(cls) -> list:
        return [tool.get_schema() for tool in cls._registry.values()]
