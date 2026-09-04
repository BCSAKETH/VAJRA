"""
NO-OP SHIM replacing the real `numba` package (backed up, not deleted, at
../../vendor_backup_numba/numba -- restore by moving it back if this is ever
wrong). The real numba + llvmlite together were 189MB of this deploy's 209MB
zip (llvmlite alone: 172MB, the single biggest thing in the whole vendor
folder) and were pushing the CLI deploy over its request-size limit
(HTTP 413), forcing every deploy through a slow manual console zip upload.

Why this is safe: nothing in VAJRA's own code imports numba directly. It's
pulled in transitively because `shap` (used in main.py for
`shap.TreeExplainer(...)`) hard-imports numba/numba.typed at the top of
several of its submodules (maskers/_tabular.py, maskers/_image.py,
explainers/_partition.py, explainers/_exact.py, utils/_clustering.py,
utils/_masked_model.py, links.py) -- so `import shap` fails without SOME
package named `numba` importable, even though those specific numba-jitted
functions live in shap's *masking/sampling* explainers (PartitionExplainer,
ExactExplainer, KernelExplainer) and maskers, none of which VAJRA ever
constructs. VAJRA only builds `shap.TreeExplainer(model,
feature_perturbation='tree_path_dependent')` -- the exact, closed-form
tree-walk algorithm for gradient-boosted trees, which never touches the
masking/sampling machinery at all (see main.py's shap usage).

This shim provides the same names (`njit`, `jit`, `prange`, `typed.List`)
so every `from numba import njit` / `import numba.typed` in shap's source
keeps working at import time, just as plain, uncompiled Python instead of
JIT-compiled machine code. Since VAJRA's actual code path never calls into
the functions those decorators wrap, the missing JIT speed is never
exercised -- functionally identical output, ~189MB lighter.
"""


def njit(*args, **kwargs):
    """Same calling convention as numba.njit: usable bare (@njit) or with
    arguments (@njit(cache=True), @njit(nopython=True), ...). Either way,
    just returns the original Python function unchanged -- no compilation."""
    if len(args) == 1 and callable(args[0]) and not kwargs:
        return args[0]

    def _decorator(fn):
        return fn
    return _decorator


jit = njit
generated_jit = njit
vectorize = njit
guvectorize = njit


def prange(*args, **kwargs):
    """numba.prange is a parallel range() used only inside @njit functions;
    plain range() is correct (just not parallelized)."""
    return range(*args, **kwargs)


class typed:
    """numba.typed.List / .Dict are typed containers for use inside @njit
    functions; plain Python list/dict behave identically for our purposes
    since nothing here is actually JIT-compiling against them."""
    List = list
    Dict = dict


class core:
    class types:
        # Referenced defensively by some libraries as type annotations for
        # numba-compiled signatures; unused at runtime once njit is a no-op.
        class _Any:
            def __getattr__(self, _name):
                return None
        pyobject = object()
        void = None

    errors = type("errors", (), {"NumbaError": Exception, "TypingError": Exception})()


__version__ = "0.0.0-shim"
