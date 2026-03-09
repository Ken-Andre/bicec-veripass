import random
import string

def calculate_mod97(ibu_base):
    """
    Calculates the Modulo 97 checksum for a numerical string.
    Following the ISO 7064 (MOD 97-10) pattern for IBAN/IBU.
    """
    # Convert alpha to digits if necessary (A=10, ..., Z=35)
    # For this mock, we assume ibu_base is already digit-converted or purely numerical
    digits = ""
    for char in ibu_base:
        if char.isdigit():
            digits += char
        else:
            digits += str(ord(char.upper()) - ord('A') + 10)
    
    remainder = int(digits) % 97
    check_digit = 98 - remainder
    return f"{check_digit:02d}"

def generate_shadow_ibu(bank_code="BICEC"):
    """
    Generates a Shadow IBU (ISO 20022) for the MVP.
    Structure: CM (Country) + Type (1) + Year (2) + Bank (5) + Seq (8) + Key (2)
    Total: 20 characters.
    """
    country_code = "CM" # Cameroon
    account_type = "1"  # Individual
    year = "26"         # 2026
    
    # Normalize bank code to 5 chars
    bank_id = bank_code[:5].upper().ljust(5, 'X')
    
    # Random sequential number (simulating database ID)
    seq = ''.join(random.choices(string.digits, k=8))
    
    # Base for checksum: Country code converted to digits (C=12, M=22) -> 1222 + ...
    # Standard IBAN logic puts CC at the end for calculation: Account + CC + 00
    base_for_key = f"{account_type}{year}{bank_id}{seq}122200"
    
    key = calculate_mod97(base_for_key)
    
    return f"{country_code}{key}{account_type}{year}{bank_id}{seq}"

if __name__ == "__main__":
    # Test generation
    for _ in range(5):
        print(f"Generated IBU: {generate_shadow_ibu()}")
