from fastapi import Header, HTTPException


USERS = [
    {
        "name": "Janish Kumar",
        "role": "Board Chair",
        "permissions": {
            "viewDocuments": True,
            "uploadDocuments": True,
            "runAnalysis": True,
            "chat": True,
            "viewFindings": True,
            "verifyDispute": True,
            "viewAudit": True,
            "viewDashboard": True,
        },
    },
    {
        "name": "Ganesh Satyabrata",
        "role": "Governance Analyst",
        "permissions": {
            "viewDocuments": True,
            "uploadDocuments": True,
            "runAnalysis": True,
            "chat": True,
            "viewFindings": True,
            "verifyDispute": False,
            "viewAudit": True,
            "viewDashboard": True,
        },
    },
    {
        "name": "Kamal Dhakal",
        "role": "Compliance Officer",
        "permissions": {
            "viewDocuments": True,
            "uploadDocuments": False,
            "runAnalysis": False,
            "chat": True,
            "viewFindings": True,
            "verifyDispute": False,
            "viewAudit": True,
            "viewDashboard": True,
        },
    },
    {
        "name": "Vyanktesh Arali",
        "role": "Ops Manager",
        "permissions": {
            "viewDocuments": True,
            "uploadDocuments": False,
            "runAnalysis": False,
            "chat": True,
            "viewFindings": True,
            "verifyDispute": False,
            "viewAudit": True,
            "viewDashboard": True,
        },
    },
    {
        "name": "Devansh Agarwal",
        "role": "Intern",
        "permissions": {
            "viewDocuments": True,
            "uploadDocuments": False,
            "runAnalysis": False,
            "chat": False,
            "viewFindings": False,
            "verifyDispute": False,
            "viewAudit": True,
            "viewDashboard": True,
        },
    },
]

DOCUMENT_ACL: dict[str, list[str]] = {
    "Board_Minutes_Jan_2026.pdf": ["Janish Kumar", "Ganesh Satyabrata"],
    "Board_Minutes_Feb_2026.pdf": ["Janish Kumar", "Ganesh Satyabrata"],
    "Board_Minutes_Mar_2026.pdf": ["Janish Kumar", "Ganesh Satyabrata"],
    "Corporate Governance Reference Framework.pdf": [
        "Janish Kumar",
        "Ganesh Satyabrata",
        "Kamal Dhakal",
        "Vyanktesh Arali",
        "Devansh Agarwal",
    ],
    "Code of Conduct.pdf": [
        "Janish Kumar",
        "Ganesh Satyabrata",
        "Kamal Dhakal",
        "Vyanktesh Arali",
        "Devansh Agarwal",
    ],
}

_USERS_BY_NAME = {u["name"]: u for u in USERS}


def get_current_user(x_user_name: str = Header(default="Janish Kumar")) -> dict:
    """FastAPI dependency: resolve X-User-Name header to a user dict."""
    user = _USERS_BY_NAME.get(x_user_name)
    if not user:
        raise HTTPException(status_code=403, detail=f"Unknown user: {x_user_name}")
    return user


def get_accessible_filenames(user_name: str) -> list[str]:
    """Return the list of document filenames this user may access."""
    return [
        filename
        for filename, allowed in DOCUMENT_ACL.items()
        if user_name in allowed
    ]


def check_permission(user: dict, permission: str) -> None:
    """Raise 403 if the user lacks the given permission."""
    if not user["permissions"].get(permission):
        raise HTTPException(
            status_code=403,
            detail=f"Permission denied: {permission} not granted to {user['role']}",
        )
