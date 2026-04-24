"""
Oracle Data Pipeline
- FPL bootstrap, fixtures, history
- Understat xG/xA/xT
- Dynamic Elo FDR
- Fixture schedule with DGW/BGW detection
"""
import asyncio
import aiohttp
import pandas as pd
import numpy as np
from typing import Optional

FPL_BASE  = "https://fantasy.premierleague.com/api"
USTAT_BASE = "https://understat.com/league/EPL"


# ─── Elo Rating System ────────────────────────────────────────────────────────

class EloRatingSystem:
    """
    Dynamic FDR via rolling Elo. Replaces flat 1-5 FPL difficulty with
    a continuous strength metric updated after every result.
    K=32 standard chess K-factor; home advantage = 60 Elo points.
    """
    K = 32
    HOME_ADV = 60
    DEFAULT = 1500

    def __init__(self):
        self.ratings: dict[int, float] = {}

    def get(self, team_id: int) -> float:
        return self.ratings.get(team_id, self.DEFAULT)

    def expected(self, a: int, b: int, home: bool = True) -> float:
        ra = self.get(a) + (self.HOME_ADV if home else 0)
        rb = self.get(b)
        return 1.0 / (1.0 + 10 ** ((rb - ra) / 400))

    def update(self, home_id: int, away_id: int,
               home_goals: int, away_goals: int):
        if home_goals > away_goals:
            s_h, s_a = 1.0, 0.0
        elif home_goals < away_goals:
            s_h, s_a = 0.0, 1.0
        else:
            s_h = s_a = 0.5

        e_h = self.expected(home_id, away_id, home=True)
        e_a = 1.0 - e_h

        self.ratings[home_id] = self.get(home_id) + self.K * (s_h - e_h)
        self.ratings[away_id] = self.get(away_id) + self.K * (s_a - e_a)

    def fdr_dynamic(self, attacker_team: int, defender_team: int) -> float:
        """
        Returns a 1.0–5.0 difficulty score for attacker facing defender.
        Higher = harder fixture.
        """
        def_rating = self.get(defender_team)
        # Normalise to 1–5: 1200 = easiest (5 scaled down), 1800 = hardest
        raw = (def_rating - 1200) / 600  # 0–1
        return round(1.0 + raw * 4.0, 2)


# ─── Fetch helpers ────────────────────────────────────────────────────────────

async def _get(session: aiohttp.ClientSession, url: str) -> dict | list:
    async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as r:
        r.raise_for_status()
        return await r.json()


async def fetch_all_oracle_data() -> dict:
    """
    Master async fetch. Returns:
        players_df, teams_df, fixtures_df, history_df,
        current_gw, elo, dgw_map, bgw_map
    """
    async with aiohttp.ClientSession() as session:
        bootstrap, fixtures = await asyncio.gather(
            _get(session, f"{FPL_BASE}/bootstrap-static/"),
            _get(session, f"{FPL_BASE}/fixtures/"),
        )

    # ── Teams ─────────────────────────────────────────────────────────────────
    teams_df = pd.DataFrame(bootstrap["teams"])
    teams_df = teams_df.rename(columns={
        "id": "team_id", "name": "team_name", "short_name": "team_short",
        "strength_attack_home":   "str_attack_h",
        "strength_attack_away":   "str_attack_a",
        "strength_defence_home":  "str_defence_h",
        "strength_defence_away":  "str_defence_a",
    })

    # ── Players ───────────────────────────────────────────────────────────────
    elements = pd.DataFrame(bootstrap["elements"])
    pos_map = {1: "GKP", 2: "DEF", 3: "MID", 4: "FWD"}
    players_df = pd.DataFrame({
        "player_id":    elements["id"],
        "name":         elements["web_name"],
        "full_name":    elements["first_name"] + " " + elements["second_name"],
        "team_id":      elements["team"],
        "position":     elements["element_type"].map(pos_map),
        "price":        elements["now_cost"] / 10,
        "ownership_pct":elements["selected_by_percent"].astype(float),
        "status":       elements["status"],
        "photo":        elements["photo"].str.replace(".jpg", "", regex=False),
        "minutes":      elements["minutes"],
        "goals":        elements["goals_scored"],
        "assists":      elements["assists"],
        "clean_sheets": elements["clean_sheets"],
        "total_pts":    elements["total_points"],
        "ppg":          elements["points_per_game"].astype(float),
        "form":         elements["form"].astype(float),
        "xgi_90":       pd.to_numeric(elements.get("expected_goal_involvements_per_90", 0), errors="coerce").fillna(0),
        # ── Injury / availability ──────────────────────────────────────────
        "chance_of_playing": pd.to_numeric(elements.get("chance_of_playing_next_round", None), errors="coerce"),
        "news":          elements.get("news", "").fillna(""),
    })
    # Derive availability probability (0.0 – 1.0) from FPL status + chance fields
    def _avail(row):
        s = str(row.get("status", "a")).lower()
        cop = row.get("chance_of_playing")
        if s == "i":   return 0.0          # injured — do not select
        if s == "s":   return 0.0          # suspended
        if s == "u":   return 0.0          # unavailable
        if s == "d":                        # doubtful — use chance_of_playing if known
            if cop is not None and not pd.isna(cop):
                return float(cop) / 100.0
            return 0.5                      # unknown doubtful → 50%
        return 1.0                          # status "a" = fully available
    players_df["availability"] = players_df.apply(_avail, axis=1)
    players_df = players_df.merge(
        teams_df[["team_id", "team_short"]], on="team_id", how="left"
    )

    # ── Fixtures ──────────────────────────────────────────────────────────────
    fix_df = pd.DataFrame(fixtures)
    fix_df = fix_df.rename(columns={
        "event": "gw", "team_h": "home_team", "team_a": "away_team",
        "team_h_difficulty": "home_fdr_flat", "team_a_difficulty": "away_fdr_flat",
        "team_h_score": "home_goals", "team_a_score": "away_goals",
    })
    fix_df = fix_df.dropna(subset=["gw"])
    fix_df["gw"] = fix_df["gw"].astype(int)

    # ── Elo ratings (built from completed fixtures) ───────────────────────────
    elo = EloRatingSystem()
    completed = fix_df.dropna(subset=["home_goals", "away_goals"])
    for _, row in completed.sort_values("gw").iterrows():
        elo.update(
            int(row["home_team"]), int(row["away_team"]),
            int(row["home_goals"]), int(row["away_goals"])
        )

    # Attach dynamic FDR to each fixture
    def _dyn_fdr(row):
        h_fdr = elo.fdr_dynamic(int(row["home_team"]), int(row["away_team"]))
        a_fdr = elo.fdr_dynamic(int(row["away_team"]), int(row["home_team"]))
        return pd.Series({"home_fdr": h_fdr, "away_fdr": a_fdr})

    dyn = fix_df.apply(_dyn_fdr, axis=1)
    fix_df[["home_fdr", "away_fdr"]] = dyn

    # ── Current GW ────────────────────────────────────────────────────────────
    events = bootstrap["events"]
    cur_ev = next((e for e in events if e["is_current"]),
                  next((e for e in events if e["is_next"]), events[-1]))
    current_gw = cur_ev["id"]

    # ── DGW / BGW maps ────────────────────────────────────────────────────────
    all_team_ids = set(teams_df["team_id"].tolist())
    dgw_map: dict[int, list[int]] = {}  # gw -> list of team_ids with 2 fixtures
    bgw_map: dict[int, list[int]] = {}  # gw -> list of team_ids with 0 fixtures

    for gw in range(current_gw, current_gw + 9):
        gw_fix = fix_df[fix_df["gw"] == gw]
        counts: dict[int, int] = {}
        for _, row in gw_fix.iterrows():
            counts[int(row["home_team"])] = counts.get(int(row["home_team"]), 0) + 1
            counts[int(row["away_team"])] = counts.get(int(row["away_team"]), 0) + 1
        dgw_map[gw] = [t for t, c in counts.items() if c >= 2]
        bgw_map[gw] = [t for t in all_team_ids if counts.get(t, 0) == 0]

    # ── History (per-player per-GW stats) ─────────────────────────────────────
    # We build a lightweight history from bootstrap element_summary if needed.
    # For now return empty — full history is fetched lazily per player.
    history_df = pd.DataFrame()

    return {
        "players_df":  players_df,
        "teams_df":    teams_df,
        "fixtures_df": fix_df,
        "history_df":  history_df,
        "current_gw":  current_gw,
        "elo":         elo,
        "dgw_map":     dgw_map,
        "bgw_map":     bgw_map,
        "events":      events,
    }


def get_fixture_count(fixtures_df: pd.DataFrame, team_id: int, gw: int) -> int:
    """Number of fixtures a team has in a given GW. 0=BGW, 1=normal, 2=DGW."""
    mask = (
        (fixtures_df["gw"] == gw) &
        ((fixtures_df["home_team"] == team_id) | (fixtures_df["away_team"] == team_id))
    )
    return int(mask.sum())
