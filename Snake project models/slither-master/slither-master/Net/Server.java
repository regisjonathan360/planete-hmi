package Net;

import model.Direction;
import model.Snake;
import java.io.*;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.*;

public class Server {
    private final ServerSocket serverSocket;
    private final List<ClientHandler> clientHandlers;
    private final GameServer gameServer;

    private final Set<String> users;
    /**
     * server constructor initialize clientHandlers List and the gameServer class
     * @param serverSocket ServerSocket
     */
    public Server(ServerSocket serverSocket) {
        clientHandlers = new ArrayList<>();
        users = new HashSet<>();
        this.serverSocket = serverSocket;
        this.gameServer=new GameServer(this);
    }
    /**
     * this method start accepting client asking for connection to the server, is a blocking method and should be run on another thread
     * and creat a ClientHandler for each on a separate thread
     */
    public void startServer() {
        System.out.println("SERVER: started\nSERVER: Waiting for connection...");
        try {
            while (!serverSocket.isClosed()) {
                Socket socket = serverSocket.accept();
                ClientHandler clientHandler = new ClientHandler(socket,users);
                System.out.println("SERVER: New player connected: "+clientHandler.getClientUserNamme());
                clientHandlers.add(clientHandler);
                gameServer.addPlayer(clientHandler,new Snake(startPos(), Direction.RIGHT));
                Thread thread = new Thread(clientHandler);
                thread.start();
            }
        }
        catch(IOException ignore){
            closeServerSocket();
        }
    }
    /**
     * set the spawn of the snake point randomly in a 200px radius
     */
    public int startPos (){
        Random rand = new Random();
        return rand.nextInt(100)+100;
    }
    public void closeServerSocket() {
        try {
            if (serverSocket != null) {
                serverSocket.close();
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
    /**
     * send message to every ClientConnected
     * @param str String
     */
    public void sendMessage(String str){
        for(ClientHandler clientHandler: clientHandlers){
            clientHandler.write(str);
        }
    }
    /**
     * while the server socket is connected update the position trying to maintain a stable 60 ticks
     */
    public void respond(){
        System.out.println("SERVER: game started");
        while(!serverSocket.isClosed()){
            try { //stable 60 ticks
                long start = System.currentTimeMillis();
                Thread t= new Thread(gameServer::update);
                t.start();
                t.join();
                long finish = System.currentTimeMillis()-start;

                if(finish<17) //1000/60 = aprox 17
                    t.sleep(17-(finish));
            }catch (InterruptedException ignore){
            }
        }
    }
    public static void main(String [] args)  {
        try {
            ServerSocket serversocket = new ServerSocket(1234);
            Server server = new Server(serversocket);
            new Thread(server::respond).start();
            new Thread(server::startServer).start();
        }catch (IOException ignore){}
    }
}