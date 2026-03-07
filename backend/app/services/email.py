import resend
from app.config import get_settings


def send_verification_email(
    to_email: str,
    claimer_name: str,
    claim_type: str,
    claim_details: str,
    verification_url: str,
):
    settings = get_settings()
    resend.api_key = settings.resend_api_key

    subject = f"{claimer_name} has a professional claim that needs your verification"

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="font-size: 20px; font-weight: 600; color: #111; margin-bottom: 24px;">Verification Request</h2>
        <p style="font-size: 15px; color: #333; line-height: 1.6;">
            <strong>{claimer_name}</strong> claims the following {claim_type}:
        </p>
        <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #e5e7eb;">
            <p style="font-size: 15px; color: #111; margin: 0; line-height: 1.8;">{claim_details}</p>
        </div>
        <p style="font-size: 15px; color: #333; line-height: 1.6;">
            Can you verify this is accurate?
        </p>
        <a href="{verification_url}" style="display: inline-block; background: #111; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 500; margin-top: 16px;">
            Review and Verify
        </a>
        <p style="font-size: 13px; color: #999; margin-top: 32px; line-height: 1.5;">
            This email was sent by Stamp, a platform for verified professional identity.
            You received this because {claimer_name} listed you as a verifier.
        </p>
    </div>
    """

    resend.Emails.send(
        {
            "from": "Stamp <verify@stamp.app>",
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
    )
