from app.config import get_supabase


def calculate_trust_score(user_id: str) -> float:
    supabase = get_supabase()

    employment = supabase.table("employment_claims").select("status").eq("user_id", user_id).execute()
    education = supabase.table("education_claims").select("status").eq("user_id", user_id).execute()

    all_claims = (employment.data or []) + (education.data or [])

    if not all_claims:
        return 0.0

    verified = sum(1 for c in all_claims if c["status"] == "verified")
    total = len(all_claims)

    score = round((verified / total) * 100, 2)

    supabase.table("profiles").update({"trust_score": score}).eq("id", user_id).execute()

    return score
