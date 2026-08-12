package Net;

import view.ConnectionMenu;
import java.io.*;
import java.net.Socket;
/**
 * This class handle communication with the server is connected to
 */
public class Client {

    private Socket socket;
    private BufferedReader bufferedReader;
    private BufferedWriter bufferedWriter;
    private String userName;
    private String snakes;
    private String foods;
    private String messageFromServer;
    /**
     * Client constructor create a client object, initialize a BufferedReader and a BufferedWriter writing and reading from and to the server connected to the socket
     * @param socket Socket object connected to the server
     * @param userName String containing the username of the client
     */
    public Client (Socket socket,String userName){
        System.out.println("Trying to connect...");
        try{
            this.socket = socket;
            this.bufferedReader = new BufferedReader(new InputStreamReader(socket.getInputStream()));
            this.bufferedWriter = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream()));
            this.userName=userName;
            System.out.println("Connected to server "+socket.getInetAddress());
        }catch (IOException e){
            closeEverything( socket, bufferedWriter, bufferedReader);
        }
    }
    /**
     * sendMessage send the username as String to the server confirming connection
     */
    public void confirmConnection(){
        try{
            bufferedWriter.write(userName);
            bufferedWriter.newLine();
            bufferedWriter.flush();
        }catch (IOException ignore){

        }
    }
    /**
     * write send the parameter string to the server with a specific structure
     * @param message String containing the message to send to the server
     */
    public void write(String message){
        if (socket.isConnected()){
            try {
                bufferedWriter.write(userName + "-" + message);
                bufferedWriter.newLine();
                bufferedWriter.flush();
            }catch (IOException ignore){

            }
        }else {
            System.out.println("server disconnected");
        }
    }
    /**
     * closeEverything close all server related class
     */
    public void closeEverything(Socket socket, BufferedWriter bufferedWriter, BufferedReader bufferedReader) {
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
    /**
     * listenForMessage read messages from server while the socket is connected everytime they get sent, it's a blocking method and need to run on a separate thread to not stop the main program
     */
    public void listenForMessage(){

        while (socket.isConnected()){
            try {
                messageFromServer=bufferedReader.readLine();
                //System.out.println(messageFromServer); //uncomment for debug
                if(messageFromServer.contains("SERVER")){//skip server sent message for debug and special action like death or connection/disconnection of player
                    System.out.println(messageFromServer);
                    if(messageFromServer.contains("SERVER: you died!"))
                        close();
                    continue;
                }
                snakes=messageFromServer.split("&")[0];
                System.out.println(snakes);
                foods=messageFromServer.split("&")[1];

            }catch (IOException e){
                closeEverything(socket,bufferedWriter,bufferedReader);
            }
        }
    }
    public void close(){
        System.out.println("SERVER: bye!");
        closeEverything(socket,bufferedWriter,bufferedReader);
    }

    public String getMessageFromServer(){
        return messageFromServer;
    }
    public String getFoods(){
        return foods;
    }
    public String getSnakes(){
        return snakes;
    }

    public String getUserName() {
        return userName;
    }
    public boolean isClosed(){
        return socket.isClosed();
    }

    public static void main(String [] args)  {
        new ConnectionMenu().setVisible(true);
    }


}

