package view;

import Net.Client;
import view.GameViewer.PvPGameView;
import view.GameViewer.ServerGameView;
import view.GameViewer.SoloGameView;
import javax.swing.*;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
public class GameWindow extends JFrame {
    public GameWindow ( Client client){
        setTitle("Slither.io");
        setSize(getWindowWidth(),getWindowHeight());
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setResizable(false);

        ServerGameView g = new ServerGameView(client);
        addMouseListener(g.getGc());
        addMouseMotionListener(g.getGc());
        setContentPane(g);

        setVisible(true);
        addWindowListener(new WindowAdapter()
        {
            @Override
            public void windowClosing(WindowEvent e)
            {
                SwingUtilities.invokeLater(MenuFrame::new);
                client.close();
                e.getWindow().dispose();
            }
        });
    }
    public GameWindow(Boolean PvP,Boolean AI){

        setTitle("Slither.io");
        setSize(getWindowWidth(),getWindowHeight());
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setResizable(false);

            if(PvP) {
                PvPGameView g = new PvPGameView();
                setContentPane(g);
                addKeyListener(g.getGc());
                addMouseListener(g.getGc());
                addMouseMotionListener(g.getGc());

            }else if(AI) {
                SoloGameView g = new SoloGameView(true);
                setContentPane(g);
                addKeyListener(g.getGc());
                addMouseListener(g.getGc());
                addMouseMotionListener(g.getGc());

            }else{
                SoloGameView g = new SoloGameView(false);
                setContentPane(g);
                addKeyListener(g.getGc());
                addMouseListener(g.getGc());
                addMouseMotionListener(g.getGc());
            }

        setVisible(true);
        addWindowListener(new WindowAdapter()
        {
            @Override
            public void windowClosing(WindowEvent e)
            {
                SwingUtilities.invokeLater(MenuFrame::new);
                e.getWindow().dispose();
            }
        });
    }
    public static int  getWindowWidth(){
        return  1100;
    }
    public static int  getWindowHeight(){
        return  600;
    }
}