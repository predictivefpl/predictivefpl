
import stripe
import os
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse

STRIPE_SECRET_KEY      = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET  = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_ID        = os.environ.get("STRIPE_PRICE_ID", "")
SUPABASE_URL           = os.environ.get("SUPABASE_URL", "https://bpwopjvvalwuisbbvimj.supabase.co")
SUPABASE_SERVICE_KEY   = os.environ.get("SUPABASE_SERVICE_KEY", "")
FRONTEND_URL           = "https://predictivefpl.com"

stripe.api_key = STRIPE_SECRET_KEY


async def create_checkout_session(request: Request):
    """Creates a Stripe Checkout session and returns the URL."""
    try:
        body = await request.json()
        email = body.get("email", "")

        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="subscription",
            customer_email=email if email else None,
            line_items=[{
                "price": STRIPE_PRICE_ID,
                "quantity": 1,
            }],
            success_url=f"{FRONTEND_URL}/upgrade?success=1",
            cancel_url=f"{FRONTEND_URL}/upgrade?cancelled=1",
            metadata={"email": email},
            subscription_data={
                "metadata": {"email": email}
            },
        )
        return JSONResponse({"url": session.url, "session_id": session.id})
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


async def stripe_webhook(request: Request):
    """Handles Stripe webhook events."""
    payload   = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # ── Payment succeeded → upgrade user to Pro ─────────────────────────────
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        email   = session.get("customer_email") or session.get("metadata", {}).get("email")
        if email:
            await _set_user_tier(email, "pro")
            print(f"✓ Upgraded {email} to Pro")

    # ── Subscription cancelled → downgrade to Free ──────────────────────────
    elif event["type"] in ("customer.subscription.deleted", "customer.subscription.paused"):
        sub = event["data"]["object"]
        # Get email from customer
        try:
            customer = stripe.Customer.retrieve(sub["customer"])
            email    = customer.get("email")
            if email:
                await _set_user_tier(email, "free")
                print(f"✓ Downgraded {email} to Free")
        except Exception as e:
            print(f"Webhook error retrieving customer: {e}")

    return JSONResponse({"received": True})


async def _set_user_tier(email: str, tier: str):
    """Updates user tier in Supabase."""
    import aiohttp
    async with aiohttp.ClientSession() as sess:
        url = f"{SUPABASE_URL}/rest/v1/users?email=eq.{email}"
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }
        async with sess.patch(url, json={"tier": tier}, headers=headers) as r:
            if r.status not in (200, 204):
                print(f"Supabase tier update failed: {r.status}")
