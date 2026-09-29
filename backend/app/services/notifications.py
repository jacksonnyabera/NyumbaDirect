import os
import logging
import smtplib
import requests
from email.message import EmailMessage


class NotificationService:
    """Small production-ready email stub with SMTP fallback and console logging."""

    @staticmethod
    def send_email(to_email: str, subject: str, message: str) -> bool:
        smtp_host = os.getenv("SMTP_HOST")
        smtp_port = int(os.getenv("SMTP_PORT") or "587")
        smtp_user = os.getenv("SMTP_USER")
        smtp_password = os.getenv("SMTP_PASSWORD")
        smtp_from = os.getenv("SMTP_FROM", "no-reply@nyumbadirect.co.ke")

        if smtp_host and smtp_user and smtp_password:
            try:
                msg = EmailMessage()
                msg["Subject"] = subject
                msg["From"] = smtp_from
                msg["To"] = to_email
                msg.set_content(message)

                with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_password)
                    server.send_message(msg)

                return True
            except Exception as exc:
                logging.warning("SMTP notification delivery failed (%s)", type(exc).__name__)
                return False

        # Never print message bodies: verification and reset links contain
        # bearer tokens and application logs are not a mail delivery channel.
        logging.warning("Email delivery is not configured; notification was not sent")
        return False

    @staticmethod
    def send_verification_code_email(to_email: str, name: str, code: str) -> bool:
        return NotificationService.send_email(
            to_email,
            "Your NyumbaDirect verification code",
            f"Hi {name},\n\nYour NyumbaDirect verification code is {code}. "
            "It expires in 10 minutes. If you did not create this account, ignore this message.\n\nNyumbaDirect Kenya",
        )

    @staticmethod
    def send_verification_code_sms(phone_number: str, code: str) -> bool:
        from app.config import settings

        if settings.sms_provider.lower() != "africas_talking" or not settings.sms_api_key:
            logging.warning("SMS delivery is not configured; verification message was not sent")
            return False
        host = (
            "https://api.sandbox.africastalking.com"
            if settings.sms_environment.lower() == "sandbox"
            else "https://api.africastalking.com"
        )
        payload = {
            "username": settings.sms_username,
            "to": phone_number,
            "message": f"Your NyumbaDirect verification code is {code}. It expires in 10 minutes.",
        }
        if settings.sms_sender_id:
            payload["from"] = settings.sms_sender_id
        try:
            response = requests.post(
                f"{host}/version1/messaging",
                headers={"apiKey": settings.sms_api_key, "Accept": "application/json"},
                data=payload,
                timeout=(3, 10),
            )
            response.raise_for_status()
            recipients = response.json().get("SMSMessageData", {}).get("Recipients", [])
            return bool(recipients) and all(
                str(item.get("status", "")).lower() in {"success", "sent", "queued"}
                for item in recipients
            )
        except (requests.RequestException, ValueError, AttributeError) as exc:
            logging.warning("SMS verification delivery failed (%s)", type(exc).__name__)
            return False

    @staticmethod
    def send_verification_email(to_email: str, name: str, token: str) -> bool:
        api_url = os.getenv(
            "PUBLIC_API_URL",
            "https://nyumbadirect-bjig.onrender.com",
        ).rstrip("/")
        verification_url = f"{api_url}/auth/verify-email?token={token}"
        body = (
            f"Hi {name},\n\n"
            "Welcome to NyumbaDirect Kenya. Please verify your email address by visiting:\n"
            f"{verification_url}\n\n"
            "After verification, you can create or manage properties and connect with landlords.\n\n"
            "Thanks,\n"
            "NyumbaDirect Kenya"
        )
        return NotificationService.send_email(
            to_email,
            "Verify your NyumbaDirect account",
            body,
        )

    @staticmethod
    def send_property_created_email(to_email: str, title: str, town: str, rent: str) -> bool:
        body = (
            f"Hi,\n\n"
            f"Your property listing '{title}' in {town} has been published successfully on NyumbaDirect Kenya.\n"
            f"Monthly rent: {rent}\n\n"
            "Your listing will be visible to verified house hunters looking for homes in Kenya.\n\n"
            "Thanks,\n"
            "NyumbaDirect Kenya"
        )
        return NotificationService.send_email(
            to_email,
            "Your property listing is live",
            body,
        )

    @staticmethod
    def send_property_inquiry_email(to_email: str, house_hunter_name: str, property_title: str) -> bool:
        body = (
            f"Hi,\n\n"
            f"{house_hunter_name} has shown interest in '{property_title}' and wants to ask if the property is available.\n"
            "Please log in to NyumbaDirect Kenya to respond in the messages inbox.\n\n"
            "Thanks,\n"
            "NyumbaDirect Kenya"
        )
        return NotificationService.send_email(
            to_email,
            "New home inquiry for your property",
            body,
        )

    @staticmethod
    def send_password_reset_email(to_email: str, name: str, token: str) -> bool:
        reset_url = f"https://www.nyumbadirect.co.ke/reset-password?token={token}"
        body = (
            f"Hi {name},\n\n"
            "We received a request to reset your NyumbaDirect password. Use this link within 30 minutes:\n"
            f"{reset_url}\n\n"
            "If you did not request this change, you can ignore this email.\n\n"
            "NyumbaDirect Kenya"
        )
        return NotificationService.send_email(
            to_email,
            "Reset your NyumbaDirect password",
            body,
        )

    @staticmethod
    def send_conversation_reply_email(to_email: str, sender_name: str, property_title: str) -> bool:
        body = (
            f"Hi,\n\n"
            f"{sender_name} has replied to your conversation about '{property_title}'.\n"
            "Log in to NyumbaDirect to read and reply to the message.\n\n"
            "Thanks,\n"
            "NyumbaDirect Kenya"
        )
        return NotificationService.send_email(
            to_email,
            "New reply to your NyumbaDirect home inquiry",
            body,
        )

    @staticmethod
    def send_profile_visit_email(to_email: str, owner_name: str, property_title: str) -> bool:
        body = (
            f"Hi {owner_name},\n\n"
            f"A potential house hunter is viewing your property profile for '{property_title}'.\n"
            "Please review your messages and profile response opportunity on NyumbaDirect Kenya.\n\n"
            "Thanks,\n"
            "NyumbaDirect Kenya"
        )
        return NotificationService.send_email(
            to_email,
            "Someone viewed your property profile",
            body,
        )
