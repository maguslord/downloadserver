import requests
import threading
import time

# Server details
SERVER_URL = "http://<VM_PUBLIC_IP>:5000"  # Replace with Azure VM's public IP

# Client alias
alias = None

def register():
    """Register the client with the server and fetch previous messages."""
    global alias
    alias = input("Enter your alias: ")
    response = requests.post(f"{SERVER_URL}/register", json={"alias": alias})
    if response.status_code == 200:
        data = response.json()
        print(data.get("message"))
        # Display all previous messages
        print("Previous messages:")
        for msg in data.get("messages", []):
            print(msg)
    else:
        print(response.json().get("error"))
        register()

def send_message():
    """Send a message to the server."""
    while True:
        message = input()
        response = requests.post(f"{SERVER_URL}/send", json={"alias": alias, "message": message})
        if response.status_code != 200:
            print(response.json().get("error"))

def receive_messages():
    """Continuously fetch and display new messages from the server."""
    seen_messages = 0
    while True:
        try:
            response = requests.get(f"{SERVER_URL}/messages")
            if response.status_code == 200:
                all_messages = response.json()
                # Display only new messages
                for msg in all_messages[seen_messages:]:
                    print(msg)
                seen_messages = len(all_messages)
            time.sleep(1)
        except Exception as e:
            print(f"Error fetching messages: {e}")
            break

def main():
    register()
    threading.Thread(target=receive_messages, daemon=True).start()
    send_message()

if __name__ == "__main__":
    main()
