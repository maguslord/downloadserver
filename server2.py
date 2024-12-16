import socket
import threading

# Server configuration
HOST = '4.240.59.10'  # Listen on all interfaces (public and private)
PORT = 5000  # Port for the server

clients = []  # List to store connected client sockets
aliases = {}  # Dictionary to store client aliases


def broadcast(message, sender=None):
    """
    Send a message to all connected clients except the sender.
    """
    for client in clients:
        if client != sender:
            try:
                client.send(message)
            except:
                # Remove client if it fails to send
                clients.remove(client)


def handle_client(client, address):
    """
    Handle communication with a connected client.
    """
    try:
        # Ask for alias
        client.send("Enter your alias:".encode('utf-8'))
        alias = client.recv(1024).decode('utf-8')
        aliases[client] = alias

        # Notify others about the new connection
        print(f"{alias} ({address}) has joined the chat.")
        broadcast(f"{alias} has joined the chat!".encode('utf-8'), sender=client)
        client.send("You are now connected to the chat!".encode('utf-8'))

        # Handle messages from this client
        while True:
            message = client.recv(1024)
            if not message:
                break  # Client disconnected
            full_message = f"{alias}: {message.decode('utf-8')}"
            print(full_message)  # Print to server console
            broadcast(full_message.encode('utf-8'), sender=client)

    except ConnectionResetError:
        print(f"Connection lost with {aliases.get(client, 'Unknown')} ({address}).")

    finally:
        # Clean up on disconnect
        alias = aliases.pop(client, "Unknown")
        clients.remove(client)
        client.close()
        broadcast(f"{alias} has left the chat.".encode('utf-8'))
        print(f"{alias} ({address}) has left the chat.")


def accept_clients():
    """
    Accept and handle incoming client connections.
    """
    while True:
        client, address = server.accept()
        print(f"New connection from {address}")
        clients.append(client)

        # Start a thread to handle the client
        thread = threading.Thread(target=handle_client, args=(client, address))
        thread.start()


# Set up the server
server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.bind((HOST, PORT))
server.listen()

print(f"Server is running on port {PORT}")
accept_clients()
