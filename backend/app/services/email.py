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

    No login required — the link goes directly to the verification page
    where the verifier can take action immediately.

    Template: minimal, professional, Stripe-receipt style.
    """
    settings = get_settings()

    if not settings.resend_api_key:
        print("[EMAIL] RESEND_API_KEY not configured — skipping email")
        return

    resend.api_key = settings.resend_api_key

    subject = f"Verify {claimer_name}'s {claim_type} claim"

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 0;">

        <div style="padding: 0 20px; margin-bottom: 32px;">
            <span style="font-size: 17px; font-weight: 700; color: #0A0A0A; letter-spacing: -0.03em;">Stamp</span>
        </div>

        <div style="border-top: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB; padding: 24px 20px; margin-bottom: 24px;">
            <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500;">Verification Request</p>
            <p style="font-size: 15px; color: #111827; margin: 0; line-height: 1.5;">
                <strong>{claimer_name}</strong> submitted a {claim_type} claim for your organization to verify.
            </p>
        </div>

        <div style="background: #F9FAFB; border-radius: 8px; padding: 20px; margin: 0 20px 24px 20px;">
            <p style="font-size: 14px; color: #111827; margin: 0; line-height: 1.8;">
                {claim_details}
            </p>
        </div>

        <div style="padding: 0 20px; margin-bottom: 32px;">
            <a href="{verification_url}"
               style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
                Review this claim
            </a>
        </div>

        <div style="padding: 0 20px; border-top: 1px solid #F3F4F6; padding-top: 20px;">
            <p style="font-size: 12px; color: #9CA3AF; margin: 0; line-height: 1.6;">
                You can verify, correct, or dispute this claim directly from the link above.
                No account or login required.
            </p>
            <p style="font-size: 12px; color: #9CA3AF; margin: 8px 0 0 0; line-height: 1.6;">
                Stamp &mdash; stampverified.com
            </p>
        </div>

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
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 0;">

        <div style="padding: 0 20px; margin-bottom: 32px;">
            <span style="font-size: 17px; font-weight: 700; color: #0A0A0A; letter-spacing: -0.03em;">Stamp</span>
        </div>

        <div style="border-top: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB; padding: 24px 20px; margin-bottom: 24px;">
            <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500;">Organization Invite</p>
            <p style="font-size: 15px; color: #111827; margin: 0; line-height: 1.5;">
                <strong>{inviter_name}</strong> wants <strong>{company_name}</strong> to verify their professional claims on Stamp.
            </p>
        </div>

        <div style="padding: 0 20px; margin-bottom: 24px;">
            <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin: 0;">
                Registration takes 2 minutes and is free. Once registered, you can verify employee and graduate claims with one click.
            </p>
        </div>

        <div style="padding: 0 20px; margin-bottom: 32px;">
            <a href="{invite_url}"
               style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
                Register {company_name}
            </a>
        </div>

        <div style="padding: 0 20px; border-top: 1px solid #F3F4F6; padding-top: 20px;">
            <p style="font-size: 12px; color: #9CA3AF; margin: 0; line-height: 1.6;">
                Stamp &mdash; stampverified.com
            </p>
        </div>

    </div>
    """

    resend.Emails.send({
        "from": "Stamp <hello@stampverified.com>",
        "to": [to_email],
        "subject": subject,
        "html": html,
    })
