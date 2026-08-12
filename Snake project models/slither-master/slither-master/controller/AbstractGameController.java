package controller;

import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;

public abstract class AbstractGameController extends MouseAdapter {

    public abstract void mouseMoved(MouseEvent e);
}
