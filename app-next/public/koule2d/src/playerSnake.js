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

    //handle the space key so that the player's snake can speed up
    var spaceKey = this.game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
    var self = this;
    spaceKey.onDown.add(this.spaceKeyDown, this);
    spaceKey.onUp.add(this.spaceKeyUp, this);
    this.addDestroyedCallback(function() {
        spaceKey.onDown.remove(this.spaceKeyDown, this);
        spaceKey.onUp.remove(this.spaceKeyUp, this);
    }, this);
}

PlayerSnake.prototype = Object.create(Snake.prototype);
PlayerSnake.prototype.constructor = PlayerSnake;

//make this snake light up and speed up when the space key is down
PlayerSnake.prototype.spaceKeyDown = function() {
    this.speed = this.fastSpeed;
    this.shadow.isLightingUp = true;
}
//make the snake slow down when the space key is up again
PlayerSnake.prototype.spaceKeyUp = function() {
    if (!this.touchBoost) {
        this.speed = this.slowSpeed;
        this.shadow.isLightingUp = false;
    }
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
    //when the game is not playing (menu, countdown): cruise straight ahead
    if (window.__koule2dGame && window.__koule2dGame.phase !== 'playing') {
        this.head.body.setZeroRotation();
        this.tempUpdate();
        return;
    }
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
