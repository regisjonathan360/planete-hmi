package model;
public class Pair implements Point{
    int x;
    int y;
    public Pair(int x, int y) {
        this.y = y;
        this.x = x;
    }
    public int getX() {
        return x;
    }
    public int getY() {
        return y;
    }
    @Override
    public String toString() {
        return x+":"+y;
    }
}