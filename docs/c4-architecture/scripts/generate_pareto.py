#!/usr/bin/env python3
"""
Generate the static Pareto SVG for ADR-040 / section 6.4 of the master
document.

This script is a ONE-SHOT, MANUAL helper. It is NOT part of the
`render.sh` pipeline — the SVG output is committed once and never
auto-regenerated, because it represents an indicative estimate (not a
piece of code that mirrors source).

Axes:
  - X : complexite de mise en place (1=simple, 5=complexe)
  - Y : cout annuel FCFA (echelle logarithmique)
  - Colour : niveau de souverainete (vert=fort, orange=moyen, rouge=faible)
  - Marker size : palier max d'utilisateurs (50 / 200 / 500 / 1000)

Output: docs/c4-architecture/diagrams/c4-6-4-pareto-acces-backoffice.svg
"""
from __future__ import annotations

import math
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # no display
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch


# --- Paths -------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
DIAGRAMS_DIR = PROJECT_DIR / "diagrams"
OUTPUT = DIAGRAMS_DIR / "c4-6-4-pareto-acces-backoffice.svg"


# --- Data --------------------------------------------------------------------
# Order matches ADR-040 Annexe A.
# Fields:
#   code   : identifiant (A..G)
#   label  : libelle court affiche sur le graphe
#   x      : complexite de mise en place (1..5)
#   y_fcfa : cout annuel FCFA (fourchette haute du palier 200 users)
#   sov    : niveau de souverainete (5=fort/on-prem, 1=faible/SaaS US)
#   scale  : palier max d'utilisateurs que l'option tient sans casse (50/200/500/1000)
#   notes  : commentaire bref
DATA = [
    {"code": "A", "label": "VPN IPSec\nsite-a-site",
     "x": 1.5, "y_fcfa": 0, "sov": 5, "scale": 1000,
     "notes": "aligne existant"},
    {"code": "B", "label": "VPN client\npar agent",
     "x": 2.5, "y_fcfa": 7_900_000, "sov": 5, "scale": 500,
     "notes": "licences + support"},
    {"code": "C", "label": "Cloudflare\nAccess Free / Team",
     "x": 1.8, "y_fcfa": 11_800_000, "sov": 2, "scale": 200,
     "notes": "gratuit <=50"},
    {"code": "D", "label": "Cloudflare\nAccess Enterprise",
     "x": 3.0, "y_fcfa": 26_000_000, "sov": 2, "scale": 1000,
     "notes": "sur devis"},
    {"code": "E", "label": "ZTNA on-prem\n(Keycloak + RP)",
     "x": 4.2, "y_fcfa": 16_000_000, "sov": 5, "scale": 1000,
     "notes": "expertise requise"},
    {"code": "F", "label": "Cloudflare Warp\nhybride",
     "x": 3.4, "y_fcfa": 11_800_000, "sov": 3, "scale": 500,
     "notes": "compromis"},
    {"code": "G", "label": "cloudflared +\nauth maison",
     "x": 3.8, "y_fcfa": 2_000_000, "sov": 5, "scale": 200,
     "notes": "pas de valeur ajoutee"},
]


# --- Style mapping -----------------------------------------------------------

# Souverainete -> couleur (vert clair -> vert fonce pour 5/4, orange clair ->
# orange fonce pour 3/2, rouge pour 1). On garde 5 niveaux.
SOV_COLOR = {
    5: "#1b7837",   # vert fonce (on-prem total)
    4: "#7fbf7b",   # vert clair (on-prem + brique externe mineure)
    3: "#fdae61",   # orange clair (hybride)
    2: "#e6550d",   # orange fonce (SaaS US)
    1: "#a50f15",   # rouge (SaaS + souverainete faible)
}
SOV_LABEL = {
    5: "on-prem total",
    4: "on-prem + externe mineur",
    3: "hybride",
    2: "SaaS US (souverainete moyenne)",
    1: "SaaS + souverainete faible",
}

# Palier d'utilisateurs -> taille du marqueur (en points^2)
SCALE_SIZE = {50: 80, 200: 140, 500: 220, 1000: 320}


# --- Render ------------------------------------------------------------------

def main() -> None:
    DIAGRAMS_DIR.mkdir(parents=True, exist_ok=True)

    fig, ax = plt.subplots(figsize=(10, 6.5))
    fig.patch.set_facecolor("white")

    # Tracer les options (A est special : cout = 0, on le place en bas de l'echelle)
    plotted_y_min = 1_000_000  # 1 M FCFA (evite log(0))
    for d in DATA:
        y = max(d["y_fcfa"], 0)
        # Cas special : VPN site-a-site BICEC (cout cache = 0, mais on l'affiche
        # en bas du graphe pour rester lisible).
        if d["code"] == "A":
            y_plot = plotted_y_min  # 1 M FCFA symbolique (inclut bande passante)
        else:
            y_plot = max(y, plotted_y_min)
        size = SCALE_SIZE[d["scale"]]
        color = SOV_COLOR[d["sov"]]
        ax.scatter(
            d["x"], y_plot,
            s=size,
            c=color,
            alpha=0.78,
            edgecolors="#222",
            linewidths=0.8,
            zorder=3,
        )
        # Annotation : code + libelle court
        ax.annotate(
            d["code"],
            xy=(d["x"], y_plot),
            xytext=(0, 0),
            textcoords="offset points",
            ha="center", va="center",
            fontsize=10, fontweight="bold",
            color="white",
            zorder=4,
        )
        # Libelle a cote du point
        ax.annotate(
            d["label"],
            xy=(d["x"], y_plot),
            xytext=(8, 0),
            textcoords="offset points",
            ha="left", va="center",
            fontsize=8.5,
            color="#222",
        )

    # Echelle log
    ax.set_yscale("log")
    ax.set_ylim(plotted_y_min * 0.7, 4e7)

    # Grille
    ax.grid(True, which="both", linestyle="--", linewidth=0.4, alpha=0.4)

    # Axes
    ax.set_xlabel("Complexite de mise en place (1 = simple, 5 = complexe)",
                  fontsize=10)
    ax.set_ylabel("Cout annuel indicatif (FCFA HT, echelle log)",
                  fontsize=10)
    ax.set_title(
        "ADR-040 / Section 6.4 — Acces distant au back-office\n"
        "Estimation indicative, 200 users, sources en ADR-040 Annexe E",
        fontsize=11,
    )

    # Graduations Y en millions de FCFA
    y_ticks = [1e6, 3e6, 1e7, 3e7]
    y_labels = ["1 M", "3 M", "10 M", "30 M FCFA"]
    ax.set_yticks(y_ticks)
    ax.set_yticklabels(y_labels)
    ax.set_xticks([1, 2, 3, 4, 5])

    # Zones colorees de recommandation
    ax.axvspan(0.5, 2.5, ymin=0.0, ymax=0.45, alpha=0.07, color="green",
               zorder=1)
    ax.axvspan(0.5, 2.5, ymin=0.45, ymax=1.0, alpha=0.07, color="orange",
               zorder=1)
    ax.axvspan(2.5, 5.5, ymin=0.0, ymax=0.55, alpha=0.07, color="yellow",
               zorder=1)
    ax.axvspan(2.5, 5.5, ymin=0.55, ymax=1.0, alpha=0.07, color="red",
               zorder=1)

    # Legendes manuelles
    legend_handles = []
    for sov in [5, 4, 3, 2, 1]:
        legend_handles.append(
            plt.Line2D([0], [0], marker="o", color="w",
                       markerfacecolor=SOV_COLOR[sov], markersize=10,
                       label=SOV_LABEL[sov])
        )
    for scale in [50, 200, 500, 1000]:
        legend_handles.append(
            plt.Line2D([0], [0], marker="o", color="w",
                       markerfacecolor="#888", markersize=math.sqrt(SCALE_SIZE[scale])/2.5,
                       label=f"jusqu'a {scale} users")
        )
    ax.legend(handles=legend_handles, loc="upper left", fontsize=8,
              framealpha=0.92, ncol=2)

    # Note de bas
    ax.text(
        0.99, 0.01,
        "Vert/orange/rouge = souverainete | Taille = palier max\n"
        "A : VPN BICEC gratuit (cout cache : bande passante, support)",
        transform=ax.transAxes,
        ha="right", va="bottom",
        fontsize=7.5, color="#555",
    )

    plt.tight_layout()
    plt.savefig(OUTPUT, format="svg", bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"wrote {OUTPUT} ({OUTPUT.stat().st_size:,} B)")

    # Also export a PNG at 200 dpi for the PDF build (some PDF engines don't
    # render SVG <img> embeds, and the PDF fallback to weasyprint rasterizes
    # them anyway). The PNG is regenerated by hand, not by render.sh.
    png_out = OUTPUT.with_suffix(".png")
    fig2, ax2 = plt.subplots(figsize=(10, 6.5))
    ax2.axis("off")
    img = plt.imread(OUTPUT) if False else None  # placeholder
    plt.close(fig2)
    # Re-render at 200 dpi for PNG
    fig3, ax3 = plt.subplots(figsize=(10, 6.5))
    ax3.set_xlim(0, 5); ax3.set_ylim(1, 4e7); ax3.set_yscale("log")
    for d in DATA:
        y = max(d["y_fcfa"], 0) or 1e6
        if d["code"] == "A":
            y = 1e6
        size = SCALE_SIZE[d["scale"]]
        color = SOV_COLOR[d["sov"]]
        ax3.scatter(d["x"], y, s=size, c=color, alpha=0.78,
                    edgecolors="#222", linewidths=0.8, zorder=3)
        ax3.annotate(d["code"], xy=(d["x"], y), ha="center", va="center",
                     fontsize=10, fontweight="bold", color="white", zorder=4)
        ax3.annotate(d["label"], xy=(d["x"], y), xytext=(8, 0),
                     textcoords="offset points", ha="left", va="center",
                     fontsize=8.5, color="#222")
    ax3.set_xlabel("Complexite (1=simple, 5=complexe)", fontsize=10)
    ax3.set_ylabel("Cout annuel FCFA (log)", fontsize=10)
    ax3.set_title("Pareto acces back-office (200 users)", fontsize=11)
    ax3.grid(True, which="both", linestyle="--", linewidth=0.4, alpha=0.4)
    plt.tight_layout()
    plt.savefig(png_out, format="png", dpi=200, bbox_inches="tight",
                facecolor="white")
    plt.close(fig3)
    print(f"wrote {png_out} ({png_out.stat().st_size:,} B)")


if __name__ == "__main__":
    main()
