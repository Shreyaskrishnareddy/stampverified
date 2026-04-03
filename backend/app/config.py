from pydantic_settings import BaseSettings
from supabase import create_client, Client
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str = ""
    resend_api_key: str = ""
    frontend_url: str = "http://localhost:3000"
    environment: str = "development"
    invite_hmac_secret: str = ""
    cron_secret: str = ""
    jsearch_api_key: str = ""
    oneprofile_supabase_url: str = ""
    oneprofile_supabase_key: str = ""
    openai_api_key: str = ""

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


_supabase_client: Client | None = None
_oneprofile_client: Client | None = None


def get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        settings = get_settings()
        _supabase_client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _supabase_client


def get_oneprofile_supabase() -> Client:
    """Get Supabase client for OneProfile job database (25,000+ jobs with pgvector)."""
    global _oneprofile_client
    if _oneprofile_client is None:
        settings = get_settings()
        _oneprofile_client = create_client(settings.oneprofile_supabase_url, settings.oneprofile_supabase_key)
    return _oneprofile_client
