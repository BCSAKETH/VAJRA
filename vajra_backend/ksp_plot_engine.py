"""
VAJRA - KSP Dark Theme Universal Dynamic Plotting Engine (Finals-part 3.md Section 57)

Renders a bounded, whitelisted set of chart archetypes (bar/line/area/box/
radar/scatter/heatmap/pie) as SVG + base64 PNG, themed to match VAJRA's dark
cockpit aesthetic, from a declarative JSON spec -- never from LLM-generated
Python code. Arbitrary code execution ("let the model write matplotlib
calls and eval/exec them") is explicitly out of scope: the plan doc's own
loophole-testing section (L391-395) flags exactly this as a real sandboxing
risk, and this codebase has no sandbox to run untrusted code in. A fixed
dispatcher over known-safe chart types with numeric-only, length-bounded
inputs delivers the actual value an officer wants (an ad-hoc chart request
no longer hits "chart type not supported") without ever executing anything
the model wrote.

CONFIRMED (2026-09-16): matplotlib/seaborn were NOT in requirements.txt
despite the plan doc's blueprint claiming they were "already installed in
the VAJRA environment" -- true only of the local dev machine that happened
to have them from an unrelated install, not the deployed AppSail build
(which installs strictly from requirements.txt). Added there as part of
this change.
"""
import base64
import io
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("ksp_plot_engine")

# KSP palette (Finals-part 3.md Section 57.1)
BG = "#0c0a09"
AXES_BG = "#1c1917"
GOLD = "#C79A4E"
AMBER = "#F59E0B"
EMERALD = "#10B981"
ROSE = "#F43F5E"
CYAN = "#06B6D4"
PURPLE = "#A855F7"
GRID = "#292524"
TEXT = "#E7E5E4"

SERIES_COLORS = [GOLD, CYAN, ROSE, EMERALD, AMBER, PURPLE]

SUPPORTED_CHART_TYPES = {"bar", "line", "area", "heatmap", "box", "radar", "scatter", "pie"}
_MAX_SERIES = 6
_MAX_POINTS = 60


def _themed_figure(figsize=(7, 4.2)):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=figsize, dpi=150)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(AXES_BG)
    for spine in ax.spines.values():
        spine.set_color(GRID)
    ax.tick_params(colors=TEXT, labelsize=9)
    ax.grid(True, color=GRID, linewidth=0.6, alpha=0.6)
    ax.set_axisbelow(True)
    return fig, ax


def _finish(fig, ax, title: str, x_label: str, y_label: str) -> Dict[str, Any]:
    import matplotlib.pyplot as plt
    if title:
        ax.set_title(title, color=GOLD, fontsize=11, fontweight="bold", family="sans-serif", pad=10)
    if x_label:
        ax.set_xlabel(x_label, color=TEXT, fontsize=9)
    if y_label:
        ax.set_ylabel(y_label, color=TEXT, fontsize=9)
    fig.tight_layout()

    svg_buf = io.StringIO()
    fig.savefig(svg_buf, format="svg", facecolor=BG)
    png_buf = io.BytesIO()
    fig.savefig(png_buf, format="png", facecolor=BG, dpi=300)
    plt.close(fig)
    return {
        "svg": svg_buf.getvalue(),
        "png_base64": base64.b64encode(png_buf.getvalue()).decode("ascii"),
        "chart_engine": "ksp_plot_engine",
    }


def render_chart(chart_type: str, series: List[Dict[str, Any]], title: str = "",
                  x_label: str = "", y_label: str = "",
                  categories: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    series: list of {"name": str, "values": [number, ...]} for bar/line/area/
            box/radar; {"name": str, "x": [...], "y": [...]} for scatter; for
            heatmap a single series with "values" as a 2D list of numbers and
            "col_categories" for column labels (`categories` is the row
            labels); for pie a single series with "values" (`categories` are
            slice labels); for radar, `categories` (or series[0].categories)
            are the spoke labels.

    Every numeric value is coerced with float()/bounded by length -- never
    trusts the caller's claim about array shape without checking, and
    returns {"error": ...} rather than raising on anything malformed so a
    bad chart request degrades to a clear message, never a crashed turn.
    """
    if chart_type not in SUPPORTED_CHART_TYPES:
        return {"error": f"Unsupported chart_type '{chart_type}'. Supported: {sorted(SUPPORTED_CHART_TYPES)}"}
    if not series or not isinstance(series, list) or len(series) > _MAX_SERIES:
        return {"error": f"series must be a list of 1-{_MAX_SERIES} entries."}

    try:
        import numpy as np
        import matplotlib.pyplot as plt
        fig, ax = _themed_figure()

        if chart_type == "bar":
            n = len(series)
            cats = (categories or [str(i) for i in range(len(series[0].get("values") or []))])[:_MAX_POINTS]
            width = 0.8 / max(1, n)
            x = np.arange(len(cats))
            for i, s in enumerate(series):
                vals = [float(v) for v in (s.get("values") or [])][:len(cats)]
                ax.bar(x[:len(vals)] + i * width, vals, width=width, label=s.get("name", f"Series {i+1}"), color=SERIES_COLORS[i % len(SERIES_COLORS)])
            ax.set_xticks(x + width * (n - 1) / 2)
            ax.set_xticklabels(cats, rotation=30, ha="right", color=TEXT, fontsize=8)
            if n > 1:
                ax.legend(facecolor=AXES_BG, edgecolor=GRID, labelcolor=TEXT, fontsize=8)

        elif chart_type in ("line", "area"):
            cats = (categories or [str(i) for i in range(len(series[0].get("values") or []))])[:_MAX_POINTS]
            x = np.arange(len(cats))
            for i, s in enumerate(series):
                vals = [float(v) for v in (s.get("values") or [])][:len(cats)]
                color = SERIES_COLORS[i % len(SERIES_COLORS)]
                ax.plot(x[:len(vals)], vals, color=color, linewidth=2, marker="o", markersize=3, label=s.get("name", f"Series {i+1}"))
                if chart_type == "area":
                    ax.fill_between(x[:len(vals)], vals, color=color, alpha=0.2)
            ax.set_xticks(x)
            ax.set_xticklabels(cats, rotation=30, ha="right", color=TEXT, fontsize=8)
            if len(series) > 1:
                ax.legend(facecolor=AXES_BG, edgecolor=GRID, labelcolor=TEXT, fontsize=8)

        elif chart_type == "box":
            data = [[float(v) for v in (s.get("values") or [])][:200] for s in series]
            names = [s.get("name", f"Series {i+1}") for i, s in enumerate(series)]
            bp = ax.boxplot(data, patch_artist=True, tick_labels=names, medianprops={"color": GOLD, "linewidth": 2})
            for i, box in enumerate(bp["boxes"]):
                box.set_facecolor(SERIES_COLORS[i % len(SERIES_COLORS)])
                box.set_alpha(0.5)
                box.set_edgecolor(TEXT)
            for part in bp["whiskers"] + bp["caps"]:
                part.set_color(TEXT)
            ax.tick_params(axis="x", colors=TEXT, labelsize=8, rotation=20)

        elif chart_type == "scatter":
            for i, s in enumerate(series):
                xs = [float(v) for v in (s.get("x") or [])][:200]
                ys = [float(v) for v in (s.get("y") or [])][:len(xs)]
                ax.scatter(xs[:len(ys)], ys, color=SERIES_COLORS[i % len(SERIES_COLORS)], s=28, alpha=0.75, label=s.get("name", f"Series {i+1}"))
            if len(series) > 1:
                ax.legend(facecolor=AXES_BG, edgecolor=GRID, labelcolor=TEXT, fontsize=8)

        elif chart_type == "heatmap":
            import seaborn as sns
            raw_matrix = series[0].get("values") or []
            matrix = [[float(v) for v in row] for row in raw_matrix][:30]
            if not matrix:
                return {"error": "heatmap requires a non-empty 2D 'values' matrix."}
            row_labels = (categories[:len(matrix)] if categories else [str(i) for i in range(len(matrix))])
            col_labels = (series[0].get("col_categories") or [str(i) for i in range(len(matrix[0]))])
            cmap = sns.blend_palette([BG, "#78350f", GOLD, "#fef08a"], as_cmap=True)
            sns.heatmap(matrix, ax=ax, cmap=cmap, xticklabels=col_labels, yticklabels=row_labels,
                        cbar_kws={"label": ""}, linewidths=0.4, linecolor=BG)
            ax.tick_params(colors=TEXT, labelsize=8)

        elif chart_type == "radar":
            cats = (categories or (series[0].get("categories") or []))
            n_cats = len(cats)
            if n_cats < 3:
                return {"error": "Radar chart needs at least 3 categories."}
            angles = list(np.linspace(0, 2 * np.pi, n_cats, endpoint=False))
            angles += angles[:1]
            plt.close(fig)
            fig = plt.figure(figsize=(6, 6), dpi=150)
            fig.patch.set_facecolor(BG)
            ax = fig.add_subplot(111, polar=True)
            ax.set_facecolor(AXES_BG)
            for i, s in enumerate(series):
                vals = [float(v) for v in (s.get("values") or [])][:n_cats]
                vals += vals[:1]
                color = SERIES_COLORS[i % len(SERIES_COLORS)]
                ax.plot(angles[:len(vals)], vals, color=color, linewidth=2, label=s.get("name", f"Series {i+1}"))
                ax.fill(angles[:len(vals)], vals, color=color, alpha=0.15)
            ax.set_xticks(angles[:-1])
            ax.set_xticklabels(cats, color=TEXT, fontsize=8)
            ax.tick_params(colors=TEXT, labelsize=7)
            ax.spines["polar"].set_color(GRID)
            ax.grid(color=GRID)
            if len(series) > 1:
                ax.legend(loc="upper right", bbox_to_anchor=(1.3, 1.1), facecolor=AXES_BG, edgecolor=GRID, labelcolor=TEXT, fontsize=8)

        elif chart_type == "pie":
            vals = [float(v) for v in (series[0].get("values") or [])][:12]
            if not vals:
                return {"error": "pie requires a non-empty 'values' list."}
            labels = (categories or [f"Slice {i+1}" for i in range(len(vals))])[:len(vals)]
            colors = [SERIES_COLORS[i % len(SERIES_COLORS)] for i in range(len(vals))]
            ax.pie(vals, labels=labels, colors=colors, autopct="%1.0f%%",
                   textprops={"color": TEXT, "fontsize": 8}, wedgeprops={"edgecolor": BG, "linewidth": 1.5})
            ax.grid(False)

        return _finish(fig, ax, title, x_label, y_label)
    except Exception as e:
        logger.error(f"render_chart failed ({chart_type}): {e}")
        return {"error": f"Chart generation failed: {e}"}
