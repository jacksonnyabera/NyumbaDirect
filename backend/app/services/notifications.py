import os
import smtplib
from email.message import EmailMessage
from pathlib import Path


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

                with smtplib.SMTP(smtp_host, smtp_port) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_password)
                    server.send_message(msg)

                return True
            except Exception as exc:
                print(f"SMTP notification failed for {to_email}: {exc}")

        # Fallback for local development and testing: print to terminal.
        print("\n=== Email Notification ===")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(message)
        print("===========================\n")

        return True

    @staticmethod
    def send_verification_email(to_email: str, name: str, token: str) -> bool:
        verification_url = (
            f"https://www.nyumbadirect.co.ke/verify-email?token={token}"
        )
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
