"""Audit logging service.

Provides a simple interface for recording security-relevant actions
to the audit_logs table. All writes are fire-and-forget — audit
logging never blocks or fails the primary action.
"""

from app.config import get_supabase


def log_action(
    action: str,
    resource_type: str,
    resource_id: str = None,
    actor_id: str = None,
    actor_type: str = "user",
    metadata: dict = None,
    ip_address: str = None,
):
    """Record an action in the audit log.

    Args:
        action: What happened (e.g. 'verified', 'disputed', 'permission_granted')
        resource_type: What was affected (e.g. 'claim', 'job', 'member', 'organization')
        resource_id: ID of the affected resource
        actor_id: Who did it (auth user ID)
        actor_type: 'user', 'member', or 'system'
        metadata: Action-specific details (JSONB)
        ip_address: Client IP when available
    """
    try:
        supabase = get_supabase()
        data = {
            "action": action,
            "resource_type": resource_type,
            "actor_type": actor_type,
        }
        if resource_id:
            data["resource_id"] = resource_id
        if actor_id:
            data["actor_id"] = actor_id
        if metadata:
            data["metadata"] = metadata
        if ip_address:
            data["ip_address"] = ip_address

        supabase.table("audit_logs").insert(data).execute()
    except Exception as e:
        print(f"[AUDIT] Failed to log action '{action}': {e}")
