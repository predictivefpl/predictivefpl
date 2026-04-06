import asyncio
import aiohttp
import pandas as pd

UNDERSTAT_BASE = "https://understat.com"

TEAM_MAP = {
    "Manchester City": "MCI", "Manchester United": "MUN", "Arsenal": "ARS",
    "Chelsea": "CHE", "Liverpool": "LIV", "Tottenham": "TOT",
    "Newcastle United": "NEW", "Aston Villa": "AVL", "West Ham": "WHU",
    "Brighton": "BHA", "Brentford": "BRE", "Fulham": "FUL",
    "Crystal Palace": "CRY", "Everton": "EVE", "Wolverhampton Wanderers": "WOL",
    "Nottingham Forest": "NFO", "Leicester": "LEI", "Southampton": "SOU",
    "Ipswich": "IPS", "Bournemouth": "BOU",
}

async def fetch_understat_season(season="2024"):
    import re, json
    url = f"{UNDERSTAT_BASE}/league/EPL/{season}"
    headers = {"User-Agent": "Mozilla/5.0"}
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers) as r:
            html = await r.text()
    match = re.search(r"playersData\s*=\s*JSON\.parse\('(.+?)'\)", html)
    if not match:
        return pd.DataFrame()
    raw = match.group(1).encode("utf-8").decode("unicode_escape")
    players = json.loads(raw)
    df = pd.DataFrame(players)
    num_cols = ["games","time","goals","xG","assists","xA","shots","key_passes","npg","npxG","xGChain","xGBuildup"]
    for c in num_cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0)
    df = df.rename(columns={
        "id":"understat_id","player_name":"name","team_title":"team",
        "time":"minutes","goals":"goals_us","xG":"xg_us","assists":"assists_us",
        "xA":"xa_us","shots":"shots","key_passes":"key_passes",
        "npg":"npg","npxG":"npxg","xGChain":"xgchain","xGBuildup":"xgbuildup",
    })
    df["minutes"] = df["minutes"].replace(0, 1)
    df["xg_per90"] = (df["xg_us"] / df["minutes"]) * 90
    df["xa_per90"] = (df["xa_us"] / df["minutes"]) * 90
    df["xgi_per90"] = df["xg_per90"] + df["xa_per90"]
    df["npxg_per90"] = (df["npxg"] / df["minutes"]) * 90
    df["shots_per90"] = (df["shots"] / df["minutes"]) * 90
    df["keypasses_per90"] = (df["key_passes"] / df["minutes"]) * 90
    df["team_short"] = df["team"].map(TEAM_MAP)
    return df

def merge_understat_to_fpl(players_df, understat_df):
    if understat_df.empty:
        return players_df
    players_df = players_df.copy()
    understat_df = understat_df.copy()
    players_df["name_lower"] = players_df["name"].str.lower().str.strip()
    understat_df["name_lower"] = understat_df["name"].str.lower().str.strip()
    us_cols = ["name_lower","team_short","xg_per90","xa_per90","xgi_per90","npxg_per90","shots_per90","keypasses_per90"]
    us_cols = [c for c in us_cols if c in understat_df.columns]
    merged = players_df.merge(understat_df[us_cols], on=["name_lower","team_short"], how="left")
    for col in ["xg_per90","xa_per90","xgi_per90","npxg_per90","shots_per90","keypasses_per90"]:
        if col not in merged.columns:
            merged[col] = 0
        merged[col] = merged[col].fillna(0)
    return merged.drop(columns=["name_lower"], errors="ignore")
