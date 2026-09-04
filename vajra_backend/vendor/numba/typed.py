"""
Part of the no-op numba shim (see __init__.py for the full explanation).
`shap/maskers/_image.py` does `import numba.typed` as a submodule import
(distinct from `from numba import typed`), which needs this file to exist.
Plain Python list/dict stand in for numba's typed containers -- correct
behavior, just without the JIT-compiled typing numba would normally enforce.
"""
List = list
Dict = dict
