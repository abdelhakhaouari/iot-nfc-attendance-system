import time
import board
import busio 
from adafruit_pn532.i2c import PN532_I2C
import binascii
import signal
import sys
import os
from dotenv import load_dotenv
load_dotenv()
from supabase import create_client, Client
from postgrest.exceptions import APIError # For catching RPC call errors too
import traceback


READ_TIMEOUT_S = 0.5
POLL_INTERVAL_S = 0.2 # How often to check for a card

# --- Supabase Configuration ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY =os.getenv("SUPABASE_SERVICE_KEY")
READER_ID = "RaspberryPi_Reader_Office" 

pn532 = None
supabase_client: Client | None = None


# --- Signal Handler ---
def signal_handler(sig, frame):
    print('\nCtrl+C detected. Exiting...')
    sys.exit(0)
signal.signal(signal.SIGINT, signal_handler)

# --- PN532 Initialization ---
def initialize_pn532():
    global pn532
    if pn532 is not None: return True
    print("Initializing PN532 over I2C...")
    try:
        i2c = busio.I2C(board.SCL, board.SDA)
        pn532 = PN532_I2C(i2c, debug=False)
        ic, ver, rev, support = pn532.firmware_version
        print(f'Found PN532 with firmware version: {ver}.{rev}')
        pn532.SAM_configuration()
        print("PN532 SAM configuration complete.")
        return True
    except Exception as e:
        print(f"ERROR: Failed to initialize PN532: {e}")
        pn532 = None
        return False

# --- Supabase Initialization  ---
def initialize_supabase():
    global supabase_client
    if supabase_client is not None: return True
    print("Initializing Supabase client...")
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_KEY env vars not set.")
        return False
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Supabase client initialized successfully.")
        return True
    except Exception as e:
        print(f"ERROR: Failed to initialize Supabase client: {e}")
        supabase_client = None
        return False

# --- RFID Reading Function ---
def get_rfid_uid_string(timeout=READ_TIMEOUT_S):
    if pn532 is None: return None
    try:
        uid = pn532.read_passive_target(timeout=timeout)
        if uid is not None and len(uid) > 0:
            return binascii.hexlify(uid).decode('ascii').upper()
        return None
    except RuntimeError:
        return None
    except Exception as e:
        print(f"ERROR during RFID read: {e}")
        return None

def call_scan_attendance_rpc(uid_string):
    """Calls the scan_attendance RPC function in Supabase."""
    if supabase_client is None:
        print("ERROR: Supabase client not initialized. Cannot call RPC.")
        return False 
    if not uid_string:
        print("WARNING: Attempted to call scan_attendance with an empty UID.")
        return False

    print(f"Calling RPC scan_attendance for UID: {uid_string}...")
    try:
        
        params = {'p_tag_uid': uid_string}
        if READER_ID: 
             params['p_reader_id'] = READER_ID

        
        response = supabase_client.rpc('scan_attendance', params).execute()

        rpc_result = response.data

        if rpc_result is True:
            print(f"SUCCESS: Scan for UID {uid_string} acknowledged by Supabase (Logged or Debounced).")
            return True
        elif rpc_result is False:
            print(f"INFO: Scan for UID {uid_string} rejected by Supabase (No active session or other condition).")
            return False
        else:
             
             print(f"WARNING: Unexpected response type from scan_attendance RPC: {rpc_result}")
             return False

    except APIError as e:
        
        print(f"ERROR: Supabase API Error calling scan_attendance for {uid_string}: {e}")
        
        return False
    except Exception as e:
        print(f"ERROR: Unexpected error calling scan_attendance RPC for {uid_string}: {e}")
        traceback.print_exc()
        return False

# --- Main Execution ---
if __name__ == "__main__":
    print("--- RFID Attendance Scanner (using Supabase RPC) ---")
    if not initialize_pn532(): sys.exit(1)
    if not initialize_supabase(): sys.exit(1)
    print("-" * 40)
    print(f"Sending scans to Supabase function: 'scan_attendance'")
    print(f"Reader ID: {READER_ID if READER_ID else 'Not Set'}")
    print("-" * 40)
    print("Ready to read RFID tags...")
    print("(Press Ctrl+C to exit)")

    while True:
        try:
            current_uid_str = get_rfid_uid_string()

            if current_uid_str:
                # --- Call the Supabase RPC function ---
                _ = call_scan_attendance_rpc(current_uid_str)
                # We log the success/failure inside the function call
                # A brief pause after detection might be good to avoid instant re-scan attempts
                # before the physical tag moves slightly
                time.sleep(0.5)
                # ------------------------------------
            else:
                # No tag detected
                print(".", end="", flush=True)

            time.sleep(POLL_INTERVAL_S)

        except KeyboardInterrupt:
            print("\nExiting program.")
            break
        except Exception as e:
            print(f"\nUnexpected error in main loop: {e}")
            traceback.print_exc()
            break

    print("Program finished.")