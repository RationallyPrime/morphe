from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_GATEWAY_BASE_URL = "https://gateway-us.pydantic.dev/proxy/openai"


class AgentSettings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore", populate_by_name=True)

    live: bool = Field(default=False, validation_alias="MORPHE_AGENT_LIVE")
    model: str | None = Field(default=None, validation_alias="MORPHE_AGENT_MODEL")
    gateway_api_key: str | None = Field(
        default=None,
        validation_alias="PYDANTIC_AI_GATEWAY_API_KEY",
    )
    gateway_base_url: str = Field(
        default=DEFAULT_GATEWAY_BASE_URL,
        validation_alias="MORPHE_AGENT_GATEWAY_BASE_URL",
    )

    @property
    def live_ready(self) -> bool:
        return self.live and self.model is not None and self.gateway_api_key is not None
