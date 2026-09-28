from getpass import getpass

from sqlalchemy import select
from pwdlib import PasswordHash

from app.database import SessionLocal
from app.models.user import User


password_hash = PasswordHash.recommended()


def main():
    print("\n=== NyumbaDirect Admin Setup ===\n")

    full_name = input("Admin full name: ").strip()
    email = input("Admin email: ").strip().lower()
    phone = input("Admin phone: ").strip()

    password = getpass("Admin password: ")
    confirm_password = getpass("Confirm password: ")

    if not full_name:
        print("Full name is required.")
        return

    if not email:
        print("Email is required.")
        return

    if not phone:
        print("Phone number is required.")
        return

    if len(password) < 8:
        print("Password must be at least 8 characters.")
        return

    if password != confirm_password:
        print("Passwords do not match.")
        return

    db = SessionLocal()

    try:
        existing = db.scalar(
            select(User).where(
                (User.email == email) |
                (User.phone_number == phone)
            )
        )

        if existing:
            print("\nA user already exists with that email or phone.")
            print(f"User ID: {existing.id}")
            print(f"Current role: {existing.role}")
            return

        admin = User(
            full_name=full_name,
            email=email,
            phone_number=phone,
            password_hash=password_hash.hash(password),
            role="ADMIN",
            is_active=True,
            is_verified=True,
        )

        db.add(admin)
        db.commit()
        db.refresh(admin)

        print("\n================================")
        print("Admin account created successfully.")
        print("================================")
        print(f"Admin ID: {admin.id}")
        print(f"Email: {admin.email}")
        print("Role: ADMIN")
        print("Verified: Yes")
        print()

    except Exception as exc:
        db.rollback()

        print("\nUnable to create admin:")
        print(exc)

    finally:
        db.close()


if __name__ == "__main__":
    main()