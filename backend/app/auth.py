from fastapi import Header, HTTPException
from backend.app.config import settings


async def verify_api_key(x_api_key: str = Header(...)):
    """Simple API key auth stub. Replace with OAuth/JWT for production."""
    if x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key

# TODO: Implement full OAuth2 / JWT auth
# TODO: Implement RBAC with roles: Org Admin, Governance Analyst, Auditor, Viewer
# TODO: Implement project-scoped permission checks
