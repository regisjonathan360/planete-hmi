/**
 * Floating virtual joystick that appears wherever the player presses and
 * steers the snake while it is dragged. Works with mouse and touch.
 * @param  {Phaser.Game} game game object
 */
VirtualJoystick = function(game) {
    this.game = game;
    this.radius = 50;

    //joystick is drawn in screen space so that it does not move with the
    //camera
    this.group = this.game.add.group();
    this.group.fixedToCamera = true;

    this.base = this.game.add.graphics(0, 0);
    this.base.beginFill(0xffffff, 0.25);
    this.base.lineStyle(2, 0xffffff, 0.7);
    this.base.drawCircle(0, 0, this.radius * 2);
    this.base.endFill();
    this.group.add(this.base);

    this.knob = this.game.add.graphics(0, 0);
    this.knob.beginFill(0xffffff, 0.75);
    this.knob.drawCircle(0, 0, this.radius * 0.85);
    this.knob.endFill();
    this.group.add(this.knob);

    this.active = false;
    this.centerX = 0;
    this.centerY = 0;
    //direction of the joystick, normalized to -1..1
    this.x = 0;
    this.y = 0;

    this.hide();
    this.game.input.onDown.add(this.pointerDown, this);
    this.game.input.onUp.add(this.pointerUp, this);
}

VirtualJoystick.prototype = {
    /**
     * Show the joystick at the position of the press
     */
    pointerDown: function(pointer) {
        this.active = true;
        this.centerX = pointer.x;
        this.centerY = pointer.y;
        this.base.x = this.centerX;
        this.base.y = this.centerY;
        this.knob.x = this.centerX;
        this.knob.y = this.centerY;
        this.base.alpha = 1;
        this.knob.alpha = 1;
    },
    /**
     * Hide the joystick and reset its direction
     */
    pointerUp: function() {
        this.active = false;
        this.hide();
        this.x = 0;
        this.y = 0;
    },
    hide: function() {
        this.base.alpha = 0;
        this.knob.alpha = 0;
    },
    /**
     * Call from the main update loop
     */
    update: function() {
        if (this.active) {
            var pointer = this.game.input.activePointer;
            if (pointer.isDown) {
                var dx = pointer.x - this.centerX;
                var dy = pointer.y - this.centerY;
                var dist = Math.sqrt(dx * dx + dy * dy);
                //clamp the knob inside the joystick base
                var scale = Math.min(dist, this.radius) / Math.max(dist, 1);
                this.knob.x = this.centerX + dx * scale;
                this.knob.y = this.centerY + dy * scale;
                this.x = dx / this.radius;
                this.y = dy / this.radius;
            }
        }
    }
};
