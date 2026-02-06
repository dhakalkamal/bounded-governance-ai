from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gemini_api_key: str = ""
    api_key: str = "dev-api-key-123"
    database_url: str = "sqlite:///./governance.db"
    frontend_url: str = "http://localhost:3000"
    upload_dir: str = "./backend/uploads"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
