/**
 * Player of the core snake for controls
 * @param  {Phaser.Game} game      game object
 * @param  {String} spriteKey Phaser sprite key
 * @param  {Number} x         coordinate
 * @param  {Number} y         coordinate
 */
PlayerSnake = function(game, spriteKey, x, y) {
    Snake.call(this, game, spriteKey, x, y);
    this.cursors = game.input.keyboard.createCursorKeys();
    this.keyboardBoostHeld = false;

    //handle the space key so that the player's snake can speed up
    this.spaceKey = this.game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
    var ejectKey = this.game.input.keyboard.addKey(Phaser.Keyboard.E);
    this.spaceKey.onDown.add(this.spaceKeyDown, this);
    this.spaceKey.onUp.add(this.spaceKeyUp, this);
    ejectKey.onDown.add(this.ejectWaste, this);
    this.addDestroyedCallback(function() {
        this.spaceKey.onDown.remove(this.spaceKeyDown, this);
        this.spaceKey.onUp.remove(this.spaceKeyUp, this);
        ejectKey.onDown.remove(this.ejectWaste, this);
    }, this);
}

PlayerSnake.prototype = Object.create(Snake.prototype);
PlayerSnake.prototype.constructor = PlayerSnake;

//make this snake light up and speed up when the space key is down
PlayerSnake.prototype.spaceKeyDown = function() {
    this.keyboardBoostHeld = true;
    this.setBoosting(true);
}
//make the snake slow down when the space key is up again
PlayerSnake.prototype.spaceKeyUp = function() {
    this.keyboardBoostHeld = false;
    if (!this.touchBoost) this.setBoosting(false);
}

// Authoritative release used by React pointer/keyboard safety handlers.
PlayerSnake.prototype.releaseBoost = function() {
    this.keyboardBoostHeld = false;
    this.touchBoost = false;
    this.setBoosting(false);
}

PlayerSnake.prototype.ejectWaste = function() {
    Snake.prototype.ejectWaste.call(this);
}

/**
 * Rotate the head towards a direction so that the snake steers that way
 * @param  {Number} dx x-component of the direction
 * @param  {Number} dy y-component of the direction
 */
PlayerSnake.prototype.steerToDirection = function(dx, dy) {
    var angle = (180*Math.atan2(dx, dy)/Math.PI);
    if (angle > 0) {
        angle = 180-angle;
    }
    else {
        angle = -180-angle;
    }
    var dif = this.head.body.angle - angle;
    this.head.body.setZeroRotation();
    //a small angular deadzone so that the head does not oscillate
    //around the target direction when going straight
    var deadzone = 1.5 * this.getRotationSpeed() * this.game.time.physicsElapsed;
    //decide whether rotating left or right will angle the head towards
    //the direction faster
    if (dif < -deadzone && dif > -180 || dif > 180) {
        this.head.body.rotateRight(this.getRotationSpeed());
    }
    else if (dif > deadzone && dif < 180 || dif < -180) {
        this.head.body.rotateLeft(this.getRotationSpeed());
    }
}

/**
 * Steer the snake towards the mouse
 */
PlayerSnake.prototype.steerTowardMouse = function() {
    var mousePosX = this.game.input.activePointer.worldX;
    var mousePosY = this.game.input.activePointer.worldY;
    this.steerToDirection(mousePosX-this.head.body.x, mousePosY-this.head.body.y);
}

/**
 * Steer the snake towards the direction of the joystick
 */
PlayerSnake.prototype.steerTowardJoystick = function() {
    this.steerToDirection(this.game.joystick.x, this.game.joystick.y);
}

/**
 * Add functionality to the original snake update method so that the player
 * can control where this snake goes
 */
PlayerSnake.prototype.tempUpdate = PlayerSnake.prototype.update;
PlayerSnake.prototype.update = function() {
    var joystick = this.game.joystick;
    // Reconcile boost from the real input state every frame. This is the
    // fallback that fixes missed keyup/pointerup events on desktop and touch.
    var shouldBoost = !!this.touchBoost || !!this.keyboardBoostHeld;
    if (shouldBoost !== this.boosting) this.setBoosting(shouldBoost);
    //when the game is not playing (menu, countdown): cruise straight ahead
    if (window.__koule2dGame && window.__koule2dGame.phase !== 'playing') {
        if (this.boosting) this.releaseBoost();
        this.head.body.setZeroRotation();
        this.tempUpdate();
        return;
    }
    if (this.touchEject) this.ejectWaste();
    //allow arrow keys to be used
    if (this.cursors.left.isDown || this.game.input.keyboard.isDown(Phaser.Keyboard.A)) {
        this.head.body.setZeroRotation();
        this.head.body.rotateLeft(this.getRotationSpeed());
    }
    else if (this.cursors.right.isDown || this.game.input.keyboard.isDown(Phaser.Keyboard.D)) {
        this.head.body.setZeroRotation();
        this.head.body.rotateRight(this.getRotationSpeed());
    }
    //use the joystick to steer while it is being dragged
    else if (joystick.active &&
        joystick.x * joystick.x + joystick.y * joystick.y > 0.03) {
        this.steerTowardJoystick();
    }
    //joystick held but centered: stop rotating
    else if (joystick.active) {
        this.head.body.setZeroRotation();
    }
    //fall back to steering towards the mouse
    else {
        this.steerTowardMouse();
    }

    //call the original snake update method
    this.tempUpdate();
}
