import socket
import threading

# Server details
HOST = '4.240.59.10'  # Replace with server's IP if needed
PORT = 5000       # Same port as the server

# Function to receive messages from the server
def receive_messages(client):
    while True:
        try:
            # Continuously listen for messages from the server
            message = client.recv(1024).decode('utf-8')
            print(message)
        except:
            print("An error occurred. Disconnecting...")
            client.close()
            break

# Function to send messages to the server
def send_messages(client):
    while True:
        try:
            # Read user input and send it to the server
            message = input()
            client.send(message.encode('utf-8'))
        except:
            print("An error occurred while sending the message.")
            client.close()
            break

def main():
    client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    client.connect((HOST, PORT))

    # Start threads for sending and receiving messages
    receive_thread = threading.Thread(target=receive_messages, args=(client,))
    send_thread = threading.Thread(target=send_messages, args=(client,))
    receive_thread.start()
    send_thread.start()

if _name_ == "_main_":
    main()