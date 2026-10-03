from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "NyumbaDirect"
    app_env: str = "production"
    debug: bool = False
    trusted_hosts: str = (
        "localhost,127.0.0.1,nyumbadirect-bjig.onrender.com,"
        "nyumbadirect.co.ke,www.nyumbadirect.co.ke"
    )

    database_url: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    public_api_url: str = ""
    database_pool_size: int = 5
    database_max_overflow: int = 10
    database_pool_timeout: int = 30
    verification_code_ttl_minutes: int = 10
    verification_code_max_attempts: int = 5
    verification_resend_cooldown_seconds: int = 60
    sms_provider: str = ""
    sms_api_key: str = ""
    sms_username: str = "sandbox"
    sms_sender_id: str = ""
    sms_environment: str = "sandbox"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_user: str = Field(
        default="",
        validation_alias=AliasChoices("smtp_user", "smtp_username", "SMTP_USER", "SMTP_USERNAME"),
    )
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "NyumbaDirect"
    smtp_from: str = Field(
        default="",
        validation_alias=AliasChoices("smtp_from", "smtp_from_email", "SMTP_FROM", "SMTP_FROM_EMAIL"),
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def allowed_hostnames(self) -> list[str]:
        hosts = [host.strip() for host in self.trusted_hosts.split(",") if host.strip()]
        for hostname in (
            "api.nyumbadirect.co.ke",
            "nyumbadirect.co.ke",
            "www.nyumbadirect.co.ke",
        ):
            if hostname not in hosts:
                hosts.append(hostname)
        if self.app_env.casefold() not in {"production", "prod"}:
            hosts.append("testserver")
        return hosts

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
