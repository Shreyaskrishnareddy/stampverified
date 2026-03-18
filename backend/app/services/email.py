import html as html_lib
import resend
from app.config import get_settings


def _esc(text: str) -> str:
    """HTML-escape user-supplied text to prevent XSS in email templates."""
    return html_lib.escape(str(text)) if text else ""


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

    safe_name = _esc(claimer_name)
    safe_type = _esc(claim_type)
    # claim_details contains intentional HTML formatting (<strong>, <br>)
    # built by our own code with already-escaped user values.
    # Do NOT escape it here — escape at the call site instead.
    safe_details = claim_details

    subject = f"Verify {claimer_name}'s {claim_type} claim"

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 0;">

        <div style="padding: 0 20px; margin-bottom: 32px;">
            <span style="font-size: 17px; font-weight: 700; color: #0A0A0A; letter-spacing: -0.03em;">Stamp</span>
        </div>

        <div style="border-top: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB; padding: 24px 20px; margin-bottom: 24px;">
            <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500;">Verification Request</p>
            <p style="font-size: 15px; color: #111827; margin: 0; line-height: 1.5;">
                <strong>{safe_name}</strong> submitted a {safe_type} claim for your organization to verify.
            </p>
        </div>

        <div style="background: #F9FAFB; border-radius: 8px; padding: 20px; margin: 0 20px 24px 20px;">
            <p style="font-size: 14px; color: #111827; margin: 0; line-height: 1.8;">
                {safe_details}
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

    safe_inviter = _esc(inviter_name)
    safe_company = _esc(company_name)

    subject = f"{inviter_name} wants {company_name} to join Stamp"

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 0;">

        <div style="padding: 0 20px; margin-bottom: 32px;">
            <span style="font-size: 17px; font-weight: 700; color: #0A0A0A; letter-spacing: -0.03em;">Stamp</span>
        </div>

        <div style="border-top: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB; padding: 24px 20px; margin-bottom: 24px;">
            <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500;">Organization Invite</p>
            <p style="font-size: 15px; color: #111827; margin: 0; line-height: 1.5;">
                <strong>{safe_inviter}</strong> wants <strong>{safe_company}</strong> to verify their professional claims on Stamp.
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
                Register {safe_company}
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


def _send_notification_email(
    to_email: str,
    subject: str,
    headline: str,
    body: str,
    cta_text: str | None = None,
    cta_url: str | None = None,
):
    """Generic notification email template. Used for all platform events.

    Minimal, professional, Stripe-receipt style. Same design language
    as verification emails.
    """
    settings = get_settings()

    if not settings.resend_api_key:
        return

    resend.api_key = settings.resend_api_key

    cta_html = ""
    if cta_text and cta_url:
        cta_html = f"""
        <div style="padding: 0 20px; margin-bottom: 32px;">
            <a href="{cta_url}"
               style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
                {_esc(cta_text)}
            </a>
        </div>
        """

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 0;">
        <div style="padding: 0 20px; margin-bottom: 32px;">
            <span style="font-size: 17px; font-weight: 700; color: #0A0A0A; letter-spacing: -0.03em;">Stamp</span>
        </div>
        <div style="border-top: 1px solid #E5E7EB; padding: 24px 20px; margin-bottom: 24px;">
            <p style="font-size: 15px; color: #111827; margin: 0 0 12px 0; font-weight: 600;">{_esc(headline)}</p>
            <p style="font-size: 14px; color: #6B7280; margin: 0; line-height: 1.6;">{_esc(body)}</p>
        </div>
        {cta_html}
        <div style="padding: 0 20px; border-top: 1px solid #F3F4F6; padding-top: 20px;">
            <p style="font-size: 12px; color: #9CA3AF; margin: 0;">Stamp &mdash; stampverified.com</p>
        </div>
    </div>
    """

    try:
        resend.Emails.send({
            "from": "Stamp <notifications@stampverified.com>",
            "to": [to_email],
            "subject": subject,
            "html": html,
        })
    except Exception as e:
        print(f"[EMAIL] Failed to send notification to {to_email}: {e}")


def send_workspace_invite_email(
    to_email: str,
    org_name: str,
    inviter_email: str,
    frontend_url: str,
):
    """Send workspace invitation email to a new team member."""
    settings = get_settings()

    if not settings.resend_api_key:
        print("[EMAIL] RESEND_API_KEY not configured — skipping email")
        return

    resend.api_key = settings.resend_api_key

    safe_org = _esc(org_name)
    safe_inviter = _esc(inviter_email.split("@")[0].replace(".", " ").title())
    join_url = f"{frontend_url}/for-employers"

    subject = f"You've been invited to join {org_name} on Stamp"

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 0;">

        <div style="padding: 0 20px; margin-bottom: 32px;">
            <span style="font-size: 17px; font-weight: 700; color: #0A0A0A; letter-spacing: -0.03em;">Stamp</span>
        </div>

        <div style="border-top: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB; padding: 24px 20px; margin-bottom: 24px;">
            <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500;">Workspace Invitation</p>
            <p style="font-size: 15px; color: #111827; margin: 0; line-height: 1.5;">
                <strong>{safe_inviter}</strong> invited you to join <strong>{safe_org}</strong> on Stamp.
            </p>
        </div>

        <div style="padding: 0 20px; margin-bottom: 24px;">
            <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin: 0;">
                Sign up with your <strong>{_esc(to_email.rsplit('@', 1)[-1])}</strong> email to join the workspace and start verifying professional claims.
            </p>
        </div>

        <div style="padding: 0 20px; margin-bottom: 32px;">
            <a href="{join_url}"
               style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
                Join {safe_org}
            </a>
        </div>

        <div style="padding: 0 20px; border-top: 1px solid #F3F4F6; padding-top: 20px;">
            <p style="font-size: 12px; color: #9CA3AF; margin: 0; line-height: 1.6;">
                Stamp &mdash; stampverified.com
            </p>
        </div>

    </div>
    """

    try:
        resend.Emails.send({
            "from": "Stamp <hello@stampverified.com>",
            "to": [to_email],
            "subject": subject,
            "html": html,
        })
    except Exception as e:
        print(f"[EMAIL] Failed to send workspace invite to {to_email}: {e}")


def send_new_application_email(to_email: str, candidate_name: str, job_title: str, frontend_url: str):
    """Notify employer: new application received."""
    _send_notification_email(
        to_email=to_email,
        subject=f"New application for {job_title}",
        headline=f"New application for {job_title}",
        body=f"{candidate_name} applied with a confirmed Stamp profile.",
        cta_text="View Applications",
        cta_url=f"{frontend_url}/employer/applications",
    )


def send_application_status_email(to_email: str, job_title: str, org_name: str, status: str, frontend_url: str):
    """Notify candidate: application status changed."""
    if status == "shortlisted":
        headline = f"You've been shortlisted for {job_title}"
        body = f"{org_name} is interested in your application."
    else:
        headline = f"Update on your application to {job_title}"
        body = f"{org_name} has decided not to move forward at this time."

    _send_notification_email(
        to_email=to_email,
        subject=headline,
        headline=headline,
        body=body,
        cta_text="View My Applications",
        cta_url=f"{frontend_url}/dashboard/applications",
    )


def send_new_message_email(to_email: str, sender_name: str, preview: str, frontend_url: str, is_employer: bool):
    """Notify: new message received."""
    _send_notification_email(
        to_email=to_email,
        subject=f"New message from {sender_name}",
        headline=f"New message from {sender_name}",
        body=preview,
        cta_text="Reply on Stamp",
        cta_url=f"{frontend_url}/{'employer' if is_employer else 'dashboard'}/messages",
    )


def send_outreach_email(to_email: str, org_name: str, job_title: str, message: str, frontend_url: str):
    """Notify candidate: recruiter reached out."""
    _send_notification_email(
        to_email=to_email,
        subject=f"{org_name} reached out about {job_title}",
        headline=f"{org_name} reached out about {job_title}",
        body=message,
        cta_text="Reply on Stamp",
        cta_url=f"{frontend_url}/dashboard/messages",
    )


def send_claim_status_email(to_email: str, org_name: str, claim_type: str, status: str, frontend_url: str):
    """Notify candidate: claim verified or disputed."""
    if status == "verified":
        headline = f"Your {claim_type} claim has been confirmed by {org_name}"
        body = "The confirmed badge now appears on your profile."
    elif status == "disputed":
        headline = f"Your {claim_type} claim was disputed by {org_name}"
        body = "You can edit and resubmit from your dashboard."
    elif status == "correction_proposed":
        headline = f"{org_name} suggested corrections to your {claim_type} claim"
        body = "Review and accept or deny the proposed changes."
    else:
        return

    _send_notification_email(
        to_email=to_email,
        subject=headline,
        headline=headline,
        body=body,
        cta_text="View Dashboard",
        cta_url=f"{frontend_url}/dashboard",
    )
