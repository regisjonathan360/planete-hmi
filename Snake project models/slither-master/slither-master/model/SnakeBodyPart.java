package model;
public class SnakeBodyPart {
    private int x;
    private int y;
    public SnakeBodyPart(int x, int y){
        this.x=x;
        this.y=y;
    }
    public int getX() {
        return x;
    }
    public int getY() {
        return y;
    }
    public void setX(int x) {
        this.x = x;
    }
    public void setY(int y) {
        this.y = y;
    }
    /**
     * this toString method need to remain as follows for the serialization of the snake
     */
    @Override
    public String toString(){
        return x+":"+y;
    }
}