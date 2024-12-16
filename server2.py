import socket
import threading

# Server details
HOST = '0.0.0.0'  # Localhost or replace with server's IP
PORT = 5000        # Choose an unused port

# List to store connected clients
clients = []
aliases = []

# Function to broadcast messages to all clients
def broadcast(message, sender_socket=None):
    for client in clients:
        if client != sender_socket:  # Don't send the message to the sender
            try:
                client.send(message)
            except:
                # Remove client if sending fails
                clients.remove(client)

# Handle communication with a client
def handle_client(client):
    while True:
        try:
            # Receive message from the client
            message = client.recv(1024)
            broadcast(message, sender_socket=client)
        except:
            # If the client disconnects, remove it
            index = clients.index(client)
            clients.remove(client)
            alias = aliases[index]
            aliases.remove(alias)
            broadcast(f"{alias} has left the chat.".encode('utf-8'))
            client.close()
            break

# Main server function
def main():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind((HOST, PORT))
    server.listen()

    print(f"Server running on {HOST}:{PORT}")

    while True:
        client, address = server.accept()
        print(f"Connected with {str(address)}")

        # Ask for and store the client's alias
        client.send("Enter your alias: ".encode('utf-8'))
        alias = client.recv(1024).decode('utf-8')
        aliases.append(alias)
        clients.append(client)

        print(f"Alias of the client is {alias}")
        broadcast(f"{alias} has joined the chat!".encode('utf-8'))
        client.send("You are now connected to the chat.".encode('utf-8'))

        # Start a thread for the client
        thread = threading.Thread(target=handle_client, args=(client,))
        thread.start()

if __name__ == "__main__":
    main()