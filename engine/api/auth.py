from fastapi import APIRouter
import httpx

router = APIRouter()

FPL_LOGIN_URL = "https://users.premierleague.com/accounts/login/"
FPL_MY_TEAM_URL = "https://fantasy.premierleague.com/api/my-team/"

@router.post("/api/fpl-login")
async def fpl_login(credentials: dict):
    email = credentials.get("email", "")
    password = credentials.get("password", "")
    if not email or not password:
        return {"success": False, "error": "Email and password required"}
    try:
        async with httpx.AsyncClient() as client:
            # Step 1: POST login
            login_resp = await client.post(FPL_LOGIN_URL, data={
                "login": email,
                "password": password,
                "app": "plfpl-web",
                "redirect_uri": "https://fantasy.premierleague.com/",
            }, headers={
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://fantasy.premierleague.com/",
            }, follow_redirects=True)

            # Check for session cookie
            cookies = dict(login_resp.cookies)
            token = cookies.get("pl_profile") or cookies.get("pl_user_jwt")

            if not token and "pl_profile" not in str(login_resp.cookies):
                return {"success": False, "error": "Invalid credentials. Please check your email and password."}

            # Step 2: Fetch private team data using session
            me_resp = await client.get(
                "https://fantasy.premierleague.com/api/me/",
                headers={"User-Agent": "Mozilla/5.0"},
                cookies=login_resp.cookies,
            )
            me_data = me_resp.json() if me_resp.status_code == 200 else {}
            player = me_data.get("player", {})
            entry = me_data.get("entry", player.get("entry", None))

            if not entry:
                return {"success": False, "error": "Could not retrieve FPL team. Please try again."}

            return {
                "success": True,
                "team_id": entry,
                "first_name": player.get("first_name", ""),
                "last_name": player.get("last_name", ""),
                "email": player.get("email", email),
            }
    except Exception as e:
        return {"success": False, "error": f"Connection failed: {str(e)}"}
