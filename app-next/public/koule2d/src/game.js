Game = function(game) {
    //phase of the game: menu, countdown, playing, paused, gameover
    this.phase = 'menu';
    this.countdownT = 0;
    this.lastCount = -1;
    this.best = 0;
    this.isRecord = false;
    this.playerColor = 0xe23030;
    //public hud callbacks used by the embedding page
    this.hud = {
        onPhase: null,
        onCountdown: null
    };
    this._touchBoost = false;
}

Game.prototype = {
    preload: function() {

        //load assets
        this.game.load.image('circle','/koule2d/asset/circle.png');
    	this.game.load.image('shadow', '/koule2d/asset/white-shadow.png');
    	this.game.load.image('background', '/koule2d/asset/tile.png');

    	this.game.load.image('eye-white', '/koule2d/asset/eye-white.png');
    	this.game.load.image('eye-black', '/koule2d/asset/eye-black.png');

        this.game.load.image('food', '/koule2d/asset/hex.png');

        //load the best score saved in local storage
        try {
            this.best = Number(localStorage.getItem('koule2d.best') || '0') || 0;
        } catch (e) {
            this.best = 0;
        }
    },
    create: function() {
        //expose this game object to the embedding page as soon as it exists
        window.__koule2dGame = this;

        var width = this.game.width;
        var height = this.game.height;

        //world is 6x6 screens, centered on the initial camera position
        var mapScale = 6;
        this.game.world.setBounds(-width*mapScale, -height*mapScale, width*mapScale*2, height*mapScale*2);
    	this.game.stage.backgroundColor = '#444';

        //add tilesprite background
        var background = this.game.add.tileSprite(-width*mapScale, -height*mapScale,
            this.game.world.width, this.game.world.height, 'background');

        //initialize physics and groups
        this.game.physics.startSystem(Phaser.Physics.P2JS);
        this.foodGroup = this.game.add.group();
        this.snakeHeadCollisionGroup = this.game.physics.p2.createCollisionGroup();
        this.foodCollisionGroup = this.game.physics.p2.createCollisionGroup();

        this.game.snakes = [];

        //create the floating virtual joystick
        this.game.joystick = new VirtualJoystick(this.game);

        //wait for the whole world to be ready before starting a run
        this.worldReady = false;
        this.game.state.onUpdateCallback = function() {
            if (!this.worldReady) {
                this.worldReady = true;
                this.initWorld();
            }
            this.update();
        }.bind(this);
    },
    /**
     * Build the map and the snakes for a fresh run
     */
    initWorld: function() {
        var width = this.game.width;
        var height = this.game.height;

        //destroy every existing snake so that the world is rebuilt cleanly
        var oldSnakes = this.game.snakes.slice();
        for (var i = 0 ; i < oldSnakes.length ; i++) {
            oldSnakes[i].destroy();
        }
        this.game.snakes = [];

        //clear any previous food
        for (var i = this.foodGroup.children.length - 1 ; i >= 0 ; i--) {
            this.foodGroup.children[i].destroy();
        }
        this.foodGroup.removeAll();

        //add food randomly, keeping the density of the original 800x500 map,
        //but capped so that the p2 physics stays smooth on large worlds
        var density = 100 / (800 * 500);
        var foodCount = Math.round(density * width * height * 6 * 6);
        foodCount = Math.min(foodCount, 2000);
        for (var i = 0 ; i < foodCount ; i++) {
            this.initFood(
                Util.randomInt(-width*6, width*6),
                Util.randomInt(-height*6, height*6)
            );
        }

        //create player
        this.player = new PlayerSnake(this.game, 'circle', 0, 0);
        this.player.isPlayer = true;
        this.player.setColor(this.playerColor);
        this.game.camera.follow(this.player.head);

        //create bots
        this.bots = [];
        this.bots.push(new BotSnake(this.game, 'circle', -200, 0));
        this.bots.push(new BotSnake(this.game, 'circle', 200, 0));

        //initialize snake groups and collision
        for (var i = 0 ; i < this.game.snakes.length ; i++) {
            var snake = this.game.snakes[i];
            snake.head.body.setCollisionGroup(this.snakeHeadCollisionGroup);
            snake.head.body.collides([this.foodCollisionGroup]);
            //callback for when a snake is destroyed
            snake.addDestroyedCallback(this.snakeDestroyed, this);
        }
    },
    /**
     * Main update loop
     */
    update: function() {
        //expose this game object to the embedding page
        window.__koule2dGame = this;

        //update the joystick
        this.game.joystick.update();

        if (this.phase === 'countdown') {
            this.countdownT -= this.game.time.physicsElapsed;
            var n = Math.ceil(this.countdownT);
            if (n !== this.lastCount && n > 0) {
                this.lastCount = n;
                if (this.hud.onCountdown) {
                    this.hud.onCountdown(n);
                }
            }
            if (this.countdownT <= 0) {
                this.setPhase('playing');
            }
        }

        //update game components
        if (this.phase === 'countdown' || this.phase === 'playing') {
            for (var i = this.game.snakes.length - 1 ; i >= 0 ; i--) {
                this.game.snakes[i].update();
            }
            for (var i = this.foodGroup.children.length - 1 ; i >= 0 ; i--) {
                var f = this.foodGroup.children[i];
                f.food.update();
            }
        }

        if (this.phase === 'playing') {
            this.checkPlayerDeath();
            this.updateScore();
        }
    },
    /**
     * Move the game from one phase to another and notify the page
     * @param {String} phase menu, countdown, playing, paused, gameover
     */
    setPhase: function(phase) {
        if (phase === this.phase) {
            return;
        }
        this.phase = phase;
        if (this.hud.onPhase) {
            this.hud.onPhase(phase, this.getScore(), this.best, this.isRecord);
        }
    },
    /**
     * Current score: the length of the player snake
     * @return {Number} score
     */
    getScore: function() {
        return this.player ? this.player.snakeLength : 0;
    },
    /**
     * Push the current score to the page whenever it changes
     */
    updateScore: function() {
        if (!this.player) {
            return;
        }
        if (this.lastScore === undefined) {
            this.lastScore = -1;
        }
        var score = this.getScore();
        if (score !== this.lastScore) {
            this.lastScore = score;
            if (this.hud.onPhase) {
                this.hud.onPhase('playing', score, this.best, false);
            }
        }
    },
    /**
     * Start a new run: rebuild the world and count down
     */
    startGame: function() {
        this.initWorld();
        this.isRecord = false;
        this.lastScore = undefined;
        this.graceT = 1.5;
        this.setPhase('countdown');
        this.countdownT = 3;
        this.lastCount = 4;
    },
    /**
     * Pause or resume the run
     */
    togglePause: function() {
        if (this.phase === 'playing') {
            this.setPhase('paused');
        }
        else if (this.phase === 'paused') {
            this.setPhase('playing');
        }
    },
    /**
     * Go back to the menu
     */
    quitToMenu: function() {
        this.setPhase('menu');
    },
    /**
     * Change the skin color of the player snake
     * @param {Number} color 24-bit hex color
     */
    setPlayerColor: function(color) {
        this.playerColor = color;
        if (this.player) {
            this.player.setColor(color);
        }
    },
    setPlayerName: function(name) {
        this.playerName = String(name || 'Joueur').slice(0, 12);
    },
    /**
     * Boost from the mobile UI button
     * @param {Boolean} active whether the boost button is pressed
     */
    setTouchBoost: function(active) {
        this._touchBoost = active;
        if (this.player) {
            this.player.setTouchBoost(active);
        }
    },
    /**
     * Check whether the player snake died this frame
     */
    checkPlayerDeath: function() {
        if (!this.player || !this.game.snakes.length) {
            return;
        }
        //grace period: the player cannot die right after a restart
        if (this.graceT === undefined) {
            this.graceT = 1.5;
        }
        this.graceT -= this.game.time.physicsElapsed;
        if (this.graceT > 0) {
            return;
        }

        var head = this.player.head.body;
        var headX = head.x;
        var headY = head.y;

        //death by hitting the world border
        var width = this.game.width;
        var height = this.game.height;
        var m = 40;
        if (Math.abs(headX) > width*6 - m || Math.abs(headY) > height*6 - m) {
            this.playerDestroyed();
            return;
        }

        //death by hitting the body of another snake (or its own body)
        for (var i = this.game.snakes.length - 1 ; i >= 0 ; i--) {
            var snake = this.game.snakes[i];
            if (snake === this.player) {
                continue;
            }
            for (var j = 0 ; j < snake.sections.length ; j++) {
                var sec = snake.sections[j];
                if (Math.abs(sec.body.x - headX) < 9 &&
                Math.abs(sec.body.y - headY) < 9) {
                    this.playerDestroyed();
                    return;
                }
            }
        }
    },
    /**
     * The player snake died: end the run and save the record
     */
    playerDestroyed: function() {
        if (this.phase !== 'playing') {
            return;
        }
        var score = this.getScore();
        this.isRecord = score > this.best;
        if (this.isRecord) {
            this.best = score;
            try {
                localStorage.setItem('koule2d.best', String(this.best));
            } catch (e) {}
        }
        this.lastScore = undefined;
        this.setPhase('gameover');
    },
    /**
     * Create a piece of food at a point
     * @param  {number} x x-coordinate
     * @param  {number} y y-coordinate
     * @return {Food}   food object created
     */
    initFood: function(x, y) {
        var f = new Food(this.game, x, y);
        f.sprite.body.setCollisionGroup(this.foodCollisionGroup);
        this.foodGroup.add(f.sprite);
        f.sprite.body.collides([this.snakeHeadCollisionGroup]);
        return f;
    },
    snakeDestroyed: function(snake) {
        //if the player died through p2 collision, end the run
        if (snake.isPlayer) {
            this.playerDestroyed();
        }
        //place food where snake was destroyed
        for (var i = 0 ; i < snake.headPath.length ;
        i += Math.round(snake.headPath.length / snake.snakeLength) * 2) {
            this.initFood(
                snake.headPath[i].x + Util.randomInt(-10,10),
                snake.headPath[i].y + Util.randomInt(-10,10)
            );
        }
    }
};
