package model;

import controller.GameController;
import java.awt.*;
import java.util.*;
import java.util.Timer;
public class GamePlane {
    private Snake snake;
    private Snake snake2;
    private AISnake aiSnake;
    private Timer gameTimer;
    private Timer foodTimer;
    private ArrayList<Food> foods;
    private GameController controller;
    private Timer countdownTimer;  // Nouveau chronomètre pour le mode solo
    private int remainingTime;
    private int countdownSeconds;
    private int score;
    public GamePlane(GameController controller){
        this.snake=new Snake(110,Direction.RIGHT);
        this.score = 0;
        this.gameTimer=new Timer();
        this.foodTimer=new Timer();
        this.countdownSeconds = 60;
        this.remainingTime = countdownSeconds *40;
        this.countdownTimer = new Timer();
        this.foods = new ArrayList<>();
        this.controller=controller;
        if(!this.controller.getModePvsP()) {

            for (int i = 0; i < 100; i++) {
                generateFood(1500,1500);
            }
            if(this.controller.isAI()) {
                this.aiSnake = new AISnake(105, Direction.DOWN, foods);
            }

        }else{
            this.snake2 = new Snake(200, Direction.LEFT);
            for (int i = 0; i < 50; i++) {
                generateFood(1100,600);
            }
        }
        gameStart();
    }

    public void gameStart(){
        if(!this.controller.getModePvsP()) {
            gameTimer.schedule(new TimerTask() {
                @Override
                public void run() {
                    snake.move(snake.getMouseX(), snake.getMouseY());
                    if(getAIMode()) {
                        aiSnake.moveAI((ArrayList<Food>) foods.clone());
                        gameTimer.schedule(new TimerTask() {
                            @Override
                            public void run() {
                                if (checkSnakeBodyWithAICollision() != 0) {
                                    gameTimer.cancel();
                                    foodTimer.cancel();
                                    countdownTimer.cancel();
                                    controller.getGv().showWinnerDialogVSAI(checkSnakeBodyWithAICollision());
                                    Timer returnToMenuTimer = new Timer();
                                    returnToMenuTimer.schedule(new TimerTask() {
                                        @Override
                                        public void run() {
                                            // Revenir au menu
                                            controller.getGv().showMenu();
                                            controller.getGv().closeCurrentGameWindow();
                                        }

                                    }, 1000);
                                }
                            }
                        },1);
                    }
                    if(checkBodyCollision()){
                        gameTimer.cancel();
                        foodTimer.cancel();
                        countdownTimer.cancel();
                        controller.getGv().showLoseDialog();
                        Timer returnToMenuTimer = new Timer();
                        returnToMenuTimer.schedule(new TimerTask() {
                            @Override
                            public void run() {
                                // Revenir au menu
                                controller.getGv().showMenu();
                                controller.getGv().closeCurrentGameWindow();


                            }
                        }, 1000);
                    }
                }
            }, 0, 25);

            countdownTimer.schedule(new TimerTask() {
                @Override
                public void run() {
                    remainingTime--;
                    if (remainingTime <= 0) {
                        // Terminer la partie lorsque le temps est écoulé
                        gameTimer.cancel();
                        foodTimer.cancel();
                        countdownTimer.cancel();
                        controller.getGv().showTimeUpDialog();
                        Timer returnToMenuTimer = new Timer();
                        returnToMenuTimer.schedule(new TimerTask() {
                            @Override
                            public void run() {
                                // Revenir au menu
                                controller.getGv().showMenu();
                                controller.getGv().closeCurrentGameWindow();

                            }
                        }, 1000);
                    }else{
                        controller.getGv().updateTimerLabel();

                    }

                }
            }, 0, 25);  // Répéter chaque seconde

            foodTimer.schedule(new TimerTask() {
                @Override
                public void run() {
                    generateFood(1500,1500);
                }
            }, 0, 1000);
        }else{
            gameTimer.schedule(new TimerTask() {
                @Override
                public void run() {
                    snake.move2(snake.getDirection());
                    snake2.move2(snake2.getDirection());
                    if(checkSnakesBodysCollision()!=0){
                        gameTimer.cancel();
                        foodTimer.cancel();
                        countdownTimer.cancel();
                        controller.getGv().showWinnerDialog(checkSnakesBodysCollision());
                        Timer returnToMenuTimer = new Timer();
                        returnToMenuTimer.schedule(new TimerTask() {
                            @Override
                            public void run() {
                                // Revenir au menu
                                controller.getGv().showMenu();
                                controller.getGv().closeCurrentGameWindow();

                            }
                        }, 1000);
                    }
                    if(checkBody2Collision()!=0){
                        gameTimer.cancel();
                        foodTimer.cancel();
                        countdownTimer.cancel();
                        controller.getGv().showWinnerDialog(checkBody2Collision());
                        Timer returnToMenuTimer = new Timer();
                        returnToMenuTimer.schedule(new TimerTask() {
                            @Override
                            public void run() {
                                // Revenir au menu
                                controller.getGv().showMenu();
                                controller.getGv().closeCurrentGameWindow();


                            }
                        }, 1000);
                    }
                }
            }, 0, 50);

            foodTimer.schedule(new TimerTask() {
                @Override
                public void run() {
                    generateFood(600,600);
                }
            }, 0, 1000);
        }

        gameTimer.schedule(new TimerTask() {
            @Override
            public void run() {
                checkFoodCollision();
            }
        }, 0, 1);

    }
    public void generateFood(int a,int b) {
        Random random = new Random();
        int x = random.nextInt(a);
        int y = random.nextInt(b);
        Color color = Color.RED; // Couleur de la nourriture
        int size = 10; // Taille de la nourriture
        // Générer un nombre aléatoire entre 0 (inclus) et 4 (exclus)
        int randomNumber = random.nextInt(4);
        Food food = new Food(x, y, randomNumber, size);
        foods.add(food);
    }
    public void checkFoodCollision() {
        for (int i = foods.size() - 1; i >= 0; i--) {
            Food food = foods.get(i);
            if (snake.collisionsWithFood(food)) {
                snake.grow();
                foods.remove(i); // Supprimer la nourriture après collision
                score += 1;  // Augmenter le score de 1 point lorsque le serpent mange de la nourriture
            }
            if (controller.getModePvsP()) {
                if (snake2.collisionsWithFood(food)) {
                    snake2.grow();
                    foods.remove(i); // Supprimer la nourriture après collision
                }
            }
            else {
                if(getAIMode()) {
                    if (aiSnake.collisionsWithFood(food)) {
                        aiSnake.grow();
                        foods.remove(i);
                    }
                }
            }
        }
    }
    public boolean checkBodyCollision(){
        return snake.getBody().get(0).getX() <= 0 || snake.getBody().get(0).getX() >= 1533 || snake.getBody().get(0).getY() >= 1533 || snake.getBody().get(0).getY() <= -100;
    }

    public int checkBody2Collision(){
        if(snake.getBody().get(0).getX() <= 0 || snake.getBody().get(0).getX() >= 1070 || snake.getBody().get(0).getY() >= 550 || snake.getBody().get(0).getY() <= 0){
            return 2;
        }
        if(snake2.getBody().get(0).getX() <= 0 || snake2.getBody().get(0).getX() >= 1070 || snake2.getBody().get(0).getY() >= 550 || snake2.getBody().get(0).getY() <= 0){
            return 1;
        }
        return 0;
    }

    public int checkSnakesBodysCollision() {
        for (int i = 0; i < snake.getBody().size(); i++) {
            if (snake2.getBody().get(0).getX() == snake.getBody().get(i).getX() && snake2.getBody().get(0).getY() == snake.getBody().get(i).getY()) {
                return 1;
            }
        }
        for (int i = 0; i < snake2.getBody().size(); i++) {
            if (snake.getBody().get(0).getX() == snake2.getBody().get(i).getX() && snake.getBody().get(0).getY() == snake2.getBody().get(i).getY()) {
                return 2;
            }
        }
        return 0;
    }

    public int checkSnakeBodyWithAICollision() {
        for (int i = 0; i < snake.getBody().size(); i++) {
            if (aiSnake.getBody().get(0).getX() == snake.getBody().get(i).getX() && aiSnake.getBody().get(0).getY() == snake.getBody().get(i).getY()) {
                return 1;
            }
        }
        for (int i = 0; i < aiSnake.getBody().size(); i++) {
            if (snake.getBody().get(0).getX() == aiSnake.getBody().get(i).getX() && snake.getBody().get(0).getY() == aiSnake.getBody().get(i).getY()) {
                return 2;
            }

        }
        return 0;
    }

    public void resetGame() {
        gameTimer.cancel();
        foodTimer.cancel();
        countdownTimer.cancel();

        controller.getGv().showMenu();  // Affiche le menu après avoir réinitialisé le jeu
    }

    public ArrayList<Food> getFoods(){
        return this.foods;
    }
    public Snake getSnake() {
        return snake;
    }
    public Snake getSnake2() {
        return snake2;
    }
    public AISnake getAiSnake(){
        return aiSnake;
    }
    public int getRemainingTime() {
        return (int)remainingTime/40;
    }
    public GameController getController() {
        return controller;
    }
    public int getScore() {
        return score;
    }
    public Boolean getAIMode(){
        return this.controller.isAI();
    }
}