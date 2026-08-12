package Net;

import java.io.*;
import java.net.Socket;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * this class handle single client serverside, is responsible to send and receive message to and from the client
 * @author Leonardo Domenicali
 */

public class ClientHandler implements Runnable{
    public static List<ClientHandler> clientHandlers = new ArrayList<>();

    private Socket socket;
    private BufferedReader bufferedReader;
    private BufferedWriter bufferedWriter;

    private String clientUserNamme;

    private String newPos;

    private boolean isAlive;

    /**
     * ClientHandler constructor instantiate a BufferedReader and a BufferedWriter connected to the client through the socket and wait for a username from the client
     * @param socket Socket connected to the client
     */
    public ClientHandler(Socket socket, Set<String> users) {
        try {
            this.isAlive=true;
            this.socket = socket;
            this.bufferedReader = new BufferedReader(new InputStreamReader(socket.getInputStream()));
            this.bufferedWriter = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream()));
            this.clientUserNamme = bufferedReader.readLine();
            while (users.contains(this.clientUserNamme)){
                this.clientUserNamme+=1;
            }
            clientHandlers.add(this);
            users.add(this.clientUserNamme);
            //broadcastMessage("SERVER: " + clientUserNamme + "has entered the chat");
        }catch (IOException e){
            closeEverything(socket,bufferedWriter,bufferedReader);
        }
    }

    @Override
    public void run() {
        receiveMessage();
    }
    /**
     * receiveMessage receive message from the client while the socket is connected
     */
    public void receiveMessage(){
        String messageFromClient;

        while (socket.isConnected()){
            try{
                messageFromClient = bufferedReader.readLine();
                if(messageFromClient==null) {
                    System.out.println("SERVER: \""+clientUserNamme+"\" disconnected");
                    closeEverything(socket, bufferedWriter, bufferedReader);
                }
                newPos=messageFromClient;
            }catch (IOException e){
                closeEverything(socket,bufferedWriter,bufferedReader);

                break;
            }
        }
    }

    public void close(){
        closeEverything(socket,bufferedWriter,bufferedReader);
    }

    /**
     * broadcastMessage broadcast a message as parameter from the client to every other client
     * @param messageToSend String
     */
    public void broadcastMessage(String messageToSend){
        for (ClientHandler clinetHandler : clientHandlers){
            try{
                if(!clinetHandler.clientUserNamme.equals(clientUserNamme)){
                    clinetHandler.bufferedWriter.write(messageToSend);
                    clinetHandler.bufferedWriter.newLine();
                    clinetHandler.bufferedWriter.flush();
                }
            }catch (IOException e){
                closeEverything(socket,bufferedWriter,bufferedReader);
            }
        }
    }

    /**
     * this method write a message from the server to the client connected at this socket
     * @param mes String message to send
     */
    public void write (String mes){
        try {
            bufferedWriter.write(mes);
            bufferedWriter.newLine();
            bufferedWriter.flush();
        }catch (IOException ignore){
        }
    }

    /**
     * write to all client connected
     */
    public void writeToAll(String mes){
        for(ClientHandler clientHandler: clientHandlers){
            clientHandler.write(mes);
        }
    }
    public void removeClientHandler(){
        clientHandlers.remove(this);
        broadcastMessage("SERVER: \"" + clientUserNamme + "\" has left");
    }

    public void closeEverything(Socket socket, BufferedWriter bufferedWriter, BufferedReader bufferedReader) {
        removeClientHandler();
        this.isAlive=false;
        try {
            if (socket != null)
                socket.close();
            if (bufferedReader != null)
                bufferedReader.close();
            if (bufferedWriter != null)
                bufferedWriter.close();
        }catch (IOException e){
            e.printStackTrace();
        }
    }
    public boolean isAlive(){
        return isAlive;
    }

    public static List<ClientHandler> getPlayers(){
        return clientHandlers;
    }

    public String getClientUserNamme() {
        return clientUserNamme;
    }

    public String getNewPos() {
        return newPos;
    }
}
