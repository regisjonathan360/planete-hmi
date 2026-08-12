package Net;

import model.Pair;
import model.Snake;
import java.util.*;
/**
 * this class serialize and deserialize message to and from the server
 */
public class Serialize {
    /**
     * serialize the player position returning a string with the mouse position change
     * @param mousx int referring to the x of the mouse
     * @param mousy int referring to the y of the mouse
     * @return String
     */
    public static String serializePlayerPos(int mousx,int mousy){
        return "x:"+mousx+",y:"+mousy;
    }

    /**
     * deserialize player mouse position from a string returning a pair object with x and y coordinate
     * @param string serialized message
     * @return Pair
     */
    public static Pair deserializePlayerPos(String string){
        int x;
        int y;
        String[] tokens =string.split(",");
        String[] t = tokens[0].split(":");
        x=Integer.parseInt(t[1]);
        t=tokens[1].split(":");
        y=Integer.parseInt(t[1]);
        return new Pair(x,y);
    }

    /**
     * remove username from string
     * @param str String
     * @param username String
     * @return resulting String
     * */
    public static String  removeUsername(String str,String username){
        return str.replace(username+"-","");
    }

    /**
     * serialize a snake including the username of the client
     * @param player map entry containing a ClientHandler and a Snake
     * @return String
     * ex: your username,730:400,584:400,438:400,292:400,146:400; size of 5
     * */
    public static String serializePlayerSnake(Map.Entry<ClientHandler, Snake> player){
        StringBuilder stringBuilder = new StringBuilder();
        stringBuilder.append(player.getKey().getClientUserNamme());
        stringBuilder.append(",");
        for(int i=0;i<player.getValue().getBody().size()-1;i++){
            stringBuilder.append(player.getValue().getBody().get(i).toString());
            stringBuilder.append(",");
        }
        stringBuilder.append(player.getValue().getBody().get(player.getValue().getBody().size()-1));
        return stringBuilder.toString();
    }

    /**
     * deserialize every snakes form a string
     * @param snakes the string of a serialized snakes
     * @return map with the username and a list of pair describing the coordinate of every snakeBodyPart
     */
    public static  Map<String,List<Pair>> deserializeSnakes(String snakes){
        String [] tokens=snakes.split(";");
        Map<String,List<Pair>> snakeMap = new HashMap<>();
        for(int i=0;i<tokens.length;i++){
            snakeMap.put(tokens[i].split(",")[0],deserializeSnake(tokens[i]));
        }
        return snakeMap;
    }

    /**
     * deserialize a single snake form a string
     * @param str String containg a SnakeBodyPart coordinate
     * @return List<Pair> of pair describing the coordinate of every snakeBodyPart
     */
    public static List<Pair> deserializeSnake(String str){
        List<Pair> snakeCoordinate=new ArrayList<>();

        String []tokens = str.split(",");
        for(int i =1;i<tokens.length;i++){
            String []coordinates=tokens[i].split(":");
            snakeCoordinate.add(new Pair(Integer.parseInt(coordinates[0]),Integer.parseInt(coordinates[1])));
        }
        return snakeCoordinate;
    }

}
