import socket
import threading

class ChatServer:
    def _init_(self, host='0.0.0.0', port=3000):
        # Use 0.0.0.0 to allow external connections
        self.host = host
        self.port = port
        
        # Create server socket
        self.server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server.bind((self.host, self.port))
        self.server.listen(5)  # Allow up to 5 pending connections
        
        # Stores connected clients and their details
        self.clients = []
        self.nicknames = []
        
        print(f"Server started on {host}:{port}")

    def broadcast(self, message, sender_client=None):
        """
        Send a message to all clients except the sender (if specified).
        
        :param message: Message to broadcast
        :param sender_client: Client to exclude from broadcast
        """
        for client in self.clients:
            # Don't send to the sender
            if client != sender_client:
                try:
                    client.send(message)
                except:
                    # Remove client if sending fails
                    self.remove_client(client)

    def handle_client(self, client):
        """
        Handle individual client communication.
        
        :param client: Connected client socket
        """
        while True:
            try:
                # Receive message from client
                message = client.recv(1024)
                
                # Broadcast message to all other clients
                self.broadcast(message, client)
            except:
                # Find and remove the disconnected client
                index = self.clients.index(client)
                nickname = self.nicknames[index]
                
                # Broadcast that user left
                leave_message = f"{nickname} left the chat!".encode('ascii')
                self.broadcast(leave_message)
                
                # Remove client from lists
                self.remove_client(client)
                break

    def remove_client(self, client):
        """
        Safely remove a client from server tracking.
        
        :param client: Client socket to remove
        """
        if client in self.clients:
            index = self.clients.index(client)
            self.clients.remove(client)
            client.close()
            
            # Remove corresponding nickname
            del self.nicknames[index]

    def accept_connections(self):
        """
        Continuously accept new client connections.
        """
        while True:
            try:
                # Accept new client connection
                client, address = self.server.accept()
                print(f"Connected with {str(address)}")
                
                # Request client nickname
                client.send('NICK'.encode('ascii'))
                nickname = client.recv(1024).decode('ascii')
                
                # Store client and nickname
                self.clients.append(client)
                self.nicknames.append(nickname)
                
                # Broadcast new user joined
                join_message = f"{nickname} joined the chat!".encode('ascii')
                self.broadcast(join_message)
                
                # Send connection confirmation to client
                client.send('Connected to the server!'.encode('ascii'))
                
                # Start a thread to handle this client
                client_thread = threading.Thread(target=self.handle_client, args=(client,))
                client_thread.start()
            
            except Exception as e:
                print(f"Error accepting connection: {e}")
                break

    def start(self):
        """
        Start the chat server.
        """
        print("Server is listening for connections...")
        
        # Start accepting connections
        accept_thread = threading.Thread(target=self.accept_connections)
        accept_thread.start()

def main():
    # Create and start the server
    server = ChatServer()
    server.start()

if __name__== "__main__":
    main()