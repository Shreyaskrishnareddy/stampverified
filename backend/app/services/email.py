import resend
from app.config import get_settings


def send_verification_email(
    to_email: str,
    claimer_name: str,
    claim_type: str,
    claim_details: str,
    verification_url: str,
):
    """Send a verification request email to an org's designated verifier.

    The email contains a link to the verification page where the org admin
    must log in to verify/correct/dispute the claim.
    """
    settings = get_settings()

    if not settings.resend_api_key:
        print("[EMAIL] RESEND_API_KEY not configured — skipping email")
        return

    resend.api_key = settings.resend_api_key

    subject = f"Verification request: {claimer_name}"

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <div style="margin-bottom: 32px;">
            <span style="font-size: 18px; font-weight: 700; color: #0A0A0A; letter-spacing: -0.02em;">Stamp</span>
        </div>

        <h2 style="font-size: 20px; font-weight: 600; color: #0A0A0A; margin-bottom: 8px;">
            Verification Request
        </h2>
        <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin-bottom: 24px;">
            <strong style="color: #0A0A0A;">{claimer_name}</strong> claims the following {claim_type}:
        </p>

        <div style="background: #F9FAFB; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #E5E7EB;">
            <p style="font-size: 15px; color: #0A0A0A; margin: 0; line-height: 1.8;">
                {claim_details}
            </p>
        </div>

        <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin-bottom: 24px;">
            Log in to your employer dashboard to verify, correct, or dispute this claim.
        </p>

        <a href="{verification_url}"
           style="display: inline-block; background: #2563EB; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 500;">
            Review Claim
        </a>

        <p style="font-size: 13px; color: #9CA3AF; margin-top: 40px; line-height: 1.5;">
            This email was sent by Stamp, a platform for verified professional identity.
            You received this because your organization is registered on Stamp and
            {claimer_name} submitted a claim for verification.
        </p>
    </div>
    """

    resend.Emails.send({
        "from": "Stamp <verify@stampverified.com>",
        "to": [to_email],
        "subject": subject,
        "html": html,
    })


def send_invite_email(
    to_email: str,
    inviter_name: str,
    company_name: str,
    invite_url: str,
):
    """Send an invite email to a company contact, asking them to register on Stamp."""
    settings = get_settings()

    if not settings.resend_api_key:
        print("[EMAIL] RESEND_API_KEY not configured — skipping email")
        return

    resend.api_key = settings.resend_api_key

    subject = f"{inviter_name} wants {company_name} to join Stamp"

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <div style="margin-bottom: 32px;">
            <span style="font-size: 18px; font-weight: 700; color: #0A0A0A; letter-spacing: -0.02em;">Stamp</span>
        </div>

        <h2 style="font-size: 20px; font-weight: 600; color: #0A0A0A; margin-bottom: 8px;">
            You're invited to join Stamp
        </h2>
        <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin-bottom: 24px;">
            <strong style="color: #0A0A0A;">{inviter_name}</strong> wants
            <strong style="color: #0A0A0A;">{company_name}</strong> to verify their professional claims on Stamp.
        </p>

        <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin-bottom: 24px;">
            Stamp is a platform where organizations verify their employees' and graduates'
            career claims. Registration takes 2 minutes and is free.
        </p>

        <a href="{invite_url}"
           style="display: inline-block; background: #2563EB; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 500;">
            Register {company_name}
        </a>

        <p style="font-size: 13px; color: #9CA3AF; margin-top: 40px; line-height: 1.5;">
            This email was sent by Stamp. You received this because {inviter_name}
            invited {company_name} to join the platform.
        </p>
    </div>
    """

    resend.Emails.send({
        "from": "Stamp <hello@stampverified.com>",
        "to": [to_email],
        "subject": subject,
        "html": html,
    })
