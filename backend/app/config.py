from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "NyumbaDirect"
    app_env: str = "development"
    debug: bool = True

    database_url: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    database_pool_size: int = 5
    database_max_overflow: int = 10
    database_pool_timeout: int = 30
    verification_code_ttl_minutes: int = 10
    verification_code_max_attempts: int = 5
    verification_resend_cooldown_seconds: int = 60
    google_client_id: str = ""
    sms_provider: str = ""
    sms_api_key: str = ""
    sms_username: str = "sandbox"
    sms_sender_id: str = ""
    sms_environment: str = "sandbox"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    mpesa_consumer_key: str = ""
    mpesa_consumer_secret: str = ""
    mpesa_passkey: str = ""
    mpesa_shortcode: str = ""
    mpesa_callback_url: str = ""
    mpesa_callback_secret: str = ""
    mpesa_environment: str = "sandbox"
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
