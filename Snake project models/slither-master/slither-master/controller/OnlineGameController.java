package controller;

import Net.Client;
import Net.Serialize;

import java.awt.event.MouseEvent;

public class OnlineGameController extends AbstractGameController {
    private Client client;

    public OnlineGameController(Client client) {

        this.client=client;
    }

    @Override
    public void mouseMoved(MouseEvent e) {
        int mouseX = e.getX();
        int mouseY = e.getY();

        client.write(Serialize.serializePlayerPos(mouseX, mouseY));
    }

}
