package view.GameViewer;
import controller.GameController;
import model.Food;
import javax.swing.*;
import java.awt.*;
public class PvPGameView extends GameView {
    private GameController gc;
    private Image background;
    private Image[] foodImage;
    private Image snakeImage;
    private Image snake2Image;
    private JLabel timerLabel;
    public PvPGameView() {
        this.gc=new GameController(true,this,false);
        background = new ImageIcon(this.getClass().getResource("/ressources/background.PNG")).getImage();
        snakeImage=new ImageIcon(this.getClass().getResource("/ressources/serpent.png")).getImage();
        snake2Image=new ImageIcon(this.getClass().getResource("/ressources/serpent2.png")).getImage();
        foodImage=new Image[4];
        foodImage[0] = new ImageIcon(this.getClass().getResource("/ressources/food.png")).getImage();
        foodImage[1] = new ImageIcon(this.getClass().getResource("/ressources/food1.png")).getImage();
        foodImage[2] = new ImageIcon(this.getClass().getResource("/ressources/food2.png")).getImage();
        foodImage[3] = new ImageIcon(this.getClass().getResource("/ressources/food3.png")).getImage();
        timerLabel = new JLabel();
        timerLabel.setFont(new Font("Arial", Font.BOLD, 20));
        timerLabel.setForeground(Color.WHITE);
        add(timerLabel);
    }
    @Override
    public void paintComponent(Graphics g) {
        super.paintComponent(g);
        g.drawImage(background, 0, 0, 1100, 600, this);

        for (int i = 0; i < gc.getGp().getSnake().getBody().size(); i++) {
            g.drawImage(snakeImage, gc.getGp().getSnake().getBody().get(i).getX(), gc.getGp().getSnake().getBody().get(i).getY(), 15, 15, this);
        }

        for (int i = 0; i < gc.getGp().getSnake2().getBody().size(); i++) {
            g.drawImage(snake2Image, gc.getGp().getSnake2().getBody().get(i).getX(), gc.getGp().getSnake2().getBody().get(i).getY(), 15, 15, this);
        }

        for (int i = 0; i < gc.getGp().getFoods().size(); i++) {
            Food food = gc.getGp().getFoods().get(i);
            g.drawImage(foodImage[food.getColor()], food.getX(), food.getY(), 10, 10, this);

        }
        repaint();
    }
    public GameController getGc() {
        return gc;
    }
    @Override
    public void updateTimerLabel() {
        timerLabel.setText("Time: " + gc.getGp().getRemainingTime() + "s");
        repaint();
    }
}
