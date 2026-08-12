package view;

import Net.Server;
import javax.swing.*;
import javax.swing.border.LineBorder;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
public class MenuFrame extends JFrame {
    public MenuFrame( ) {
        setTitle("Slither.io Menu");
        setSize(600, 500);
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setResizable(false);
        setLayout(null); // Use null layout manager for absolute positioning
        // Créer les boutons du menu
        JButton soloButton = new JButton("Solo");
        JButton pvspButton = new JButton("PvsP");
        JButton AIButton = new JButton("AI");
        JButton quitButton = new JButton("Quit");
        JButton onlineButton = new JButton("Online");
        JButton startServerButton = new JButton("<html>start<br>server<br>");

        // Style des boutons
        soloButton.setBackground(new Color(0, 255, 0)); // Couleur verte
        soloButton.setForeground(Color.WHITE); // Texte blanc
        soloButton.setFont(new Font("Arial", Font.BOLD, 20));

        AIButton.setBackground(new Color(0, 255, 0)); // Couleur verte
        AIButton.setForeground(Color.WHITE); // Texte blanc
        AIButton.setFont(new Font("Arial", Font.BOLD, 20));

        onlineButton.setBackground(new Color(0, 255, 0)); // Couleur verte
        onlineButton.setForeground(Color.WHITE); // Texte blanc
        onlineButton.setFont(new Font("Arial", Font.BOLD, 20));

        pvspButton.setBackground(new Color(0, 255, 0)); // Couleur verte
        pvspButton.setForeground(Color.WHITE); // Texte blanc
        pvspButton.setFont(new Font("Arial", Font.BOLD, 20));

        quitButton.setBackground(new Color(255, 0, 0)); // Couleur rouge
        quitButton.setForeground(Color.WHITE); // Texte blanc
        quitButton.setFont(new Font("Arial", Font.BOLD, 20));

        startServerButton.setBackground(new Color(57, 111, 245)); // Couleur verte
        startServerButton.setForeground(Color.WHITE); // Texte blanc
        startServerButton.setFont(new Font("Arial", Font.BOLD, 10));
        startServerButton.setBorder(new LineBorder(Color.BLACK));

        onlineButton.setBounds(200, 100, 200, 50);
        soloButton.setBounds(200, 160, 200, 50);
        pvspButton.setBounds(200, 220, 200, 50);
        AIButton.setBounds(200,280,200,50);
        quitButton.setBounds(200, 340, 200, 50);
        startServerButton.setBounds(30, 30, 50, 50);

        // Ajouter des actions aux boutons
        soloButton.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                // Fermer le menu et lancer le jeu
                dispose(); // Ferme la fenêtre du menu
                new GameWindow(false,false); // Lance la fenêtre du jeu
            }
        });

        AIButton.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                // Fermer le menu et lancer le jeu
                dispose(); // Ferme la fenêtre du menu
                new GameWindow(false,true); // Lance la fenêtre du jeu
            }
        });

        pvspButton.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                // Fermer le menu et lancer le jeu
                dispose(); // Ferme la fenêtre du menu
                new GameWindow(true,false); // Lance la fenêtre du jeu
            }
        });
        quitButton.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                System.exit(0); // Quitte l'application
            }
        });
        onlineButton.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                dispose();
                new ConnectionMenu().setVisible(true);
            }
        });
        startServerButton.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                Server.main(new String[]{});
                startServerButton.setEnabled(false);
            }
        });
        add(soloButton);
        add(pvspButton);
        add(quitButton);
        add(onlineButton);
        add(startServerButton);
        add(AIButton);

        // Mettre en forme le menu
        JLabel titleLabel = new JLabel("Slither.io Game");
        titleLabel.setFont(new Font("Arial", Font.BOLD, 24));
        titleLabel.setForeground(Color.WHITE);
        titleLabel.setBackground(Color.BLACK);
        titleLabel.setBounds(210, 50, 300, 50);
        add(titleLabel);

        // Load the background image with an absolute path
        ImageIcon backgroundImage = new ImageIcon("C:\\yassine\\Java\\Projectsss\\NewSlither\\ressources\\MenuBackgound.jpg");
        JLabel backgroundLabel = new JLabel(backgroundImage);
        backgroundLabel.setBounds(0, 0, getWidth(), getHeight());
        add(backgroundLabel);

        getContentPane().setBackground(Color.BLACK); // Fond noir
        setLocationRelativeTo(null); // Centrer la fenêtre sur l'écran
        setVisible(true);
    }
    public static void main(String[] args) {
        new MenuFrame().setVisible(true);
    }
}
