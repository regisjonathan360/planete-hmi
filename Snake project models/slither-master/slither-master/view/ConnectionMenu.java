package view;

import Net.Client;
import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.io.IOException;
import java.net.InetAddress;
import java.net.Socket;
/**
 *This class extend JFrame, is the interface to join a server hosted game and enable the user to change his username
 * and enter a specific ip for the server (for default it connect to a local hosted server)
 */
public class ConnectionMenu extends JFrame {
    private Client client;
    public ConnectionMenu(){
        setTitle("Slither.io Menu");
        setSize(600, 500);
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setResizable(false);
        setLayout(null); // Use null layout manager for absolute positioning

        JButton join = new JButton("Join");

        join.setBackground(new Color(0, 255, 0));
        join.setForeground(Color.WHITE);
        join.setFont(new Font("Arial", Font.BOLD, 20));
        join.setBounds(200, 230, 200, 50);
        add(join);
        JTextField hostAddress = new JTextField("localhost");
        hostAddress.setBounds(230,120,140,20);
        hostAddress.setBackground(null);
        hostAddress.setBorder(null);
        hostAddress.setFont(new Font("Arial", Font.BOLD, 10));
        hostAddress.setHorizontalAlignment(JTextField.CENTER);
        //empty the textField when it's clicked by the user (ensure a default host address)
        hostAddress.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                hostAddress.setText("");
            }
        });
        add(hostAddress);
        JTextField usernameTextBox=new JTextField("your username");
        usernameTextBox.setBounds(200, 160, 200, 50);
        usernameTextBox.setBackground(null);
        usernameTextBox.setBorder(null);
        usernameTextBox.setToolTipText("your username");
        usernameTextBox.setFont(new Font("Arial", Font.BOLD, 20));
        usernameTextBox.setHorizontalAlignment(JTextField.CENTER);
        //empty the textField when it's clicked by the user (ensure a default username)
        usernameTextBox.addMouseListener(new MouseAdapter(){
            @Override
            public void mouseClicked(MouseEvent e){
                usernameTextBox.setText("");
            }
        });
        add(usernameTextBox,BorderLayout.CENTER);
        //when the join button in clicked
        join.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {

                dispose();
                String username=usernameTextBox.getText();
                String hostAdressString = hostAddress.getText();
                try {
                    System.out.println(InetAddress.getLocalHost());
                    Socket socket = new Socket(InetAddress.getByName(hostAdressString),1234);//open a sever at a specified host address at post 1234 (default port for all this project)
                    Client client = new Client(socket,username);
                    client.confirmConnection();
                    new Thread(client::listenForMessage).start();
                    new GameWindow(client);
                }catch (IOException ignore){
                    System.out.println("CLIENT: connection error");
                    new MenuFrame().setVisible(true);
                }
            }
        });

        JLabel titleLabel = new JLabel("Slither.io Game");
        titleLabel.setFont(new Font("Arial", Font.BOLD, 24));
        titleLabel.setForeground(Color.WHITE);
        titleLabel.setBackground(Color.BLACK);
        titleLabel.setBounds(210, 50, 300, 50);
        add(titleLabel);

        ImageIcon backgroundImage = new ImageIcon("C:\\yassine\\Java\\Projectsss\\NewSlither\\ressources\\MenuBackgound.jpg");
        JLabel backgroundLabel = new JLabel(backgroundImage);
        backgroundLabel.setBounds(0, 0, getWidth(), getHeight());
        add(backgroundLabel);

        getContentPane().setBackground(Color.BLACK);
        setLocationRelativeTo(null);
        setVisible(true);
    }
}
