Game = function(game) {
    //phase of the game: menu, countdown, playing, paused, gameover
    this.phase = 'menu';
    this.countdownT = 0;
    this.lastCount = -1;
    this.best = 0;
    this.isRecord = false;
    this.playerColor = 0xe23030;
    this.playerSkin = { id: '01_neon_cyan', frame: '01_neon_cyan', name: 'Neon Cyan', base: 0x0ff0ff, accent: 0x006bff, style: 'pulse' };
    this.playerName = 'Joueur';
    this.soundEnabled = true;
    this._audioContext = null;
    //public hud callbacks used by the embedding page
    this.hud = {
        onPhase: null,
        onCountdown: null,
        onLeaderboard: null
    };
    this.boardTimer = 0;
    this.lastBoardKey = '';
    this._touchBoost = false;
    this._touchEject = false;
    // Prevent callbacks from an old run from interfering with a replay while
    // Phaser is rebuilding the arena synchronously.
    this.restarting = false;
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
        this.game.load.image('food-hmi-real', '/brand/icon-192x192.png');
        this.game.load.image('food-spotify-real', '/koule2d/food/food-spotify-real.webp');
        this.game.load.image('food-audiomack-real', '/koule2d/food/food-audiomack-real.webp');
        this.game.load.image('food-deezer-real', '/koule2d/food/food-deezer-real.webp');
        this.game.load.image('food-tiktok-real', '/koule2d/food/food-tiktok-real.webp');
        this.game.load.image('food-flame-blue-real', '/koule2d/food/food-flame-blue-real.webp');
        this.game.load.image('food-flame-red-real', '/koule2d/food/food-flame-red-real.webp');
        this.game.load.image('food-music-real', '/koule2d/food/food-music-real.webp');
        this.game.load.image('food-waste-real', '/koule2d/food/food-waste-real.webp');
        this.game.load.image('food-hmi', '/koule2d/asset/food-hmi.svg');
        this.game.load.image('food-spotify', '/koule2d/asset/food-spotify.svg');
        this.game.load.image('food-audiomack', '/koule2d/asset/food-audiomack.svg');
        this.game.load.image('food-apple-music', '/koule2d/asset/food-apple-music.svg');
        this.game.load.image('food-deezer', '/koule2d/asset/food-deezer.svg');
        this.game.load.image('food-instagram', '/koule2d/asset/food-instagram.svg');
        this.game.load.image('food-youtube', '/koule2d/asset/food-youtube.svg');
        this.game.load.image('food-flame-blue', '/koule2d/asset/food-flame-blue.svg');
        this.game.load.image('food-flame-red', '/koule2d/asset/food-flame-red.svg');
        this.game.load.image('food-waste', '/koule2d/asset/food-waste.svg');
        this.game.load.atlasJSONHash('skin-body-atlas', '/koule2d/skins/skin-segment.webp', '/koule2d/skins/skin-segment.json');
        this.game.load.atlasJSONHash('skin-head-atlas', '/koule2d/skins/skin-head.webp', '/koule2d/skins/skin-head.json');
        this.game.load.atlasJSONHash('skin-tail-atlas', '/koule2d/skins/skin-tail.webp', '/koule2d/skins/skin-tail.json');

        //load the best score saved in local storage
        try {
            this.best = Number(localStorage.getItem('koule2d.best') || '0') || 0;
            this.soundEnabled = localStorage.getItem('koule2d.sound') !== 'off';
        } catch (e) {
            this.best = 0;
        }
    },
    create: function() {
        //expose this game object to the embedding page as soon as it exists
        window.__koule2dGame = this;

        var width = this.game.width;
        var height = this.game.height;

        // The arena is intentionally twice as large as the previous 2.5 map.
        // The walls are created below as real static P2 bodies; the logical
        // bounds remain as a second safety net for fast/kinematic snakes.
        this.mapScale = 5.0;
        this.wallThickness = 54;
        this.arenaBounds = null;
        this.arenaWalls = [];
        var mapScale = this.mapScale;
        this.game.world.setBounds(-width*mapScale, -height*mapScale, width*mapScale*2, height*mapScale*2);
        this.game.stage.backgroundColor = '#08051e';
        this.foodKeys = ['food-hmi', 'food-spotify', 'food-audiomack', 'food-apple-music', 'food-deezer', 'food-instagram', 'food-youtube', 'food-flame-blue', 'food-flame-red'];
        this.createFoodBitmaps();

        /* Arène HMI : fond dessiné par Phaser (pas de DOM, pas d'image blanche
           héritée de l'ancien prototype). La grille reste légère pour ne pas
           coûter de FPS, tandis que les étoiles donnent une profondeur lisible. */
        var worldLeft = -width * mapScale;
        var worldTop = -height * mapScale;
        var worldWidth = this.game.world.width;
        var worldHeight = this.game.world.height;
        var background = this.game.add.graphics(worldLeft, worldTop);
        background.beginFill(0x08051e, 1);
        background.drawRect(0, 0, worldWidth, worldHeight);
        background.lineStyle(1, 0x2de2ff, 0.08);
        for (var gridX = 0; gridX <= worldWidth; gridX += 80) {
            background.moveTo(gridX, 0);
            background.lineTo(gridX, worldHeight);
        }
        for (var gridY = 0; gridY <= worldHeight; gridY += 80) {
            background.moveTo(0, gridY);
            background.lineTo(worldWidth, gridY);
        }
        background.lineStyle(8, 0xff2bd6, 0.65);
        background.drawRect(10, 10, worldWidth - 20, worldHeight - 20);
        background.endFill();

        var stars = this.game.add.graphics(worldLeft, worldTop);
        for (var star = 0; star < 180; star++) {
            var starColor = star % 3 === 0 ? 0xff2bd6 : 0x2de2ff;
            stars.beginFill(starColor, 0.18 + (star % 4) * 0.08);
            stars.drawCircle(Util.randomInt(20, worldWidth - 20), Util.randomInt(20, worldHeight - 20), star % 5 === 0 ? 3 : 1.5);
            stars.endFill();
        }

        //initialize physics and groups
        this.game.physics.startSystem(Phaser.Physics.P2JS);
        this.foodGroup = this.game.add.group();
        /* Un seul emitter partagé : les consommations produisent un feedback
           arcade sans créer/détruire un emitter à chaque frame. */
        this.particles = this.game.add.emitter(0, 0, 120);
        this.particles.makeParticles('food');
        this.particles.gravity = 0;
        this.particles.setAlpha(0.95, 0, 320);
        this.particles.setScale(0.8, 0.15, 0.8, 0.15, 320);
        this.snakeHeadCollisionGroup = this.game.physics.p2.createCollisionGroup();
        this.snakeEdgeCollisionGroup = this.game.physics.p2.createCollisionGroup();
        this.foodCollisionGroup = this.game.physics.p2.createCollisionGroup();
        this.wallCollisionGroup = this.game.physics.p2.createCollisionGroup();
        this.createArenaWalls(width, height);

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
     * Create four static P2 walls around the playable rectangle. Kinematic
     * snake heads are also checked by the logical bounds below because a very
     * fast body can cross a thin wall between physics steps.
     */
    createArenaWalls: function(width, height) {
        var mapScale = this.mapScale || 5.0;
        var wallThickness = this.wallThickness || 54;
        var left = -width * mapScale;
        var right = width * mapScale;
        var top = -height * mapScale;
        var bottom = height * mapScale;
        var centerX = (left + right) / 2;
        var centerY = (top + bottom) / 2;
        this.arenaBounds = { left: left, right: right, top: top, bottom: bottom };
        this.arenaWalls = [];

        var makeWall = function(x, y, wallWidth, wallHeight, name) {
            var body = this.game.physics.p2.createBody(x, y, 0, true);
            body.addRectangle(wallWidth, wallHeight, 0, 0, 0);
            body.static = true;
            body.name = name;
            body.isArenaWall = true;
            body.setCollisionGroup(this.wallCollisionGroup);
            body.collides([this.snakeHeadCollisionGroup, this.snakeEdgeCollisionGroup, this.foodCollisionGroup]);
            this.arenaWalls.push(body);
        }.bind(this);

        makeWall(left - wallThickness / 2, centerY, wallThickness, (bottom - top) + wallThickness * 2, 'arena-wall-left');
        makeWall(right + wallThickness / 2, centerY, wallThickness, (bottom - top) + wallThickness * 2, 'arena-wall-right');
        makeWall(centerX, top - wallThickness / 2, (right - left) + wallThickness * 2, wallThickness, 'arena-wall-top');
        makeWall(centerX, bottom + wallThickness / 2, (right - left) + wallThickness * 2, wallThickness, 'arena-wall-bottom');
    },
    getArenaBounds: function() {
        if (this.arenaBounds) return this.arenaBounds;
        var mapScale = this.mapScale || 5.0;
        return {
            left: -this.game.width * mapScale,
            right: this.game.width * mapScale,
            top: -this.game.height * mapScale,
            bottom: this.game.height * mapScale
        };
    },
    getFoodBounds: function(tier) {
        var bounds = this.getArenaBounds();
        var wallSafeMargin = (this.wallThickness || 54) + 92 + Math.max(0, Number(tier) || 1) * 5;
        return {
            left: bounds.left + wallSafeMargin,
            right: bounds.right - wallSafeMargin,
            top: bounds.top + wallSafeMargin,
            bottom: bounds.bottom - wallSafeMargin
        };
    },
    clampFoodPoint: function(x, y, tier) {
        var bounds = this.getFoodBounds(tier);
        return {
            x: Math.max(bounds.left, Math.min(bounds.right, Number(x) || 0)),
            y: Math.max(bounds.top, Math.min(bounds.bottom, Number(y) || 0))
        };
    },
    onSnakeWallContact: function(phaserBody) {
        if (!phaserBody || !phaserBody.isArenaWall) return;
        var state = this.game.state.getCurrentState();
        if (this.isPlayer) {
            if (state && state.playerDestroyed) state.playerDestroyed();
        } else if (this.destroy) {
            this.destroy();
        }
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
            var oldFoodSprite = this.foodGroup.children[i];
            if (oldFoodSprite.food) oldFoodSprite.food.destroy();
            else oldFoodSprite.destroy();
        }
        this.foodGroup.removeAll();
        this.foodRespawnQueue = [];
        this.nextFoodSpawnAt = 0;

        // Keep a playable amount of food on the enlarged map. The cap avoids
        // turning every collectible into a costly P2 body.
        var density = 100 / (800 * 500);
        var mapScale = this.mapScale || 5.0;
        var foodCount = Math.round(density * width * height * mapScale * mapScale);
        foodCount = Math.min(foodCount, 1000);
        this.targetFoodCount = foodCount;
        for (var i = 0 ; i < foodCount ; i++) {
            var initialPoint = this.findFoodSpawnPoint(1);
            this.initFood(initialPoint.x, initialPoint.y);
        }

        //create player
        this.player = new PlayerSnake(this.game, 'circle', 0, 0);
        this.player.isPlayer = true;
        this.player.setSkin(this.playerSkin);
        this.game.camera.follow(this.player.head);

        //create bots
        this.bots = [];
        var botData = [
            ['Zéphyr', -260, -40, 0x2de2ff, 0xffb020, '01_neon_cyan', 18, 'scavenger'],
            ['Nova', 240, 40, 0xff2bd6, 0x8b2fff, '13_pink_plasma', 25, 'opportunist'],
            ['Rara', -120, 260, 0x35e6ff, 0xff3b30, '46_tropical_cyan', 33, 'defender'],
            ['Kreyòl', 360, -220, 0xffb020, 0xff4d22, '24_street_orange', 42, 'hunter'],
            ['Tempo', -360, -240, 0x9cff57, 0x2de2ff, '41_neon_lime', 52, 'hunter']
        ];
        for (var b = 0; b < botData.length; b++) {
            var data = botData[b];
            var bot = new BotSnake(this.game, 'circle', data[1], data[2], data[6], data[7]);
            bot.name = data[0];
            bot.setSkin({ id: data[5], frame: data[5], name: data[0], base: data[3], accent: data[4], style: b % 2 ? 'stripe' : 'pulse' });
            this.bots.push(bot);
        }

        //initialize snake groups and collision
        for (var i = 0 ; i < this.game.snakes.length ; i++) {
            var snake = this.game.snakes[i];
            snake.head.body.setCollisionGroup(this.snakeHeadCollisionGroup);
            snake.head.body.collides([this.foodCollisionGroup, this.wallCollisionGroup]);
            snake.edge.body.setCollisionGroup(this.snakeEdgeCollisionGroup);
            snake.edge.body.collides([this.wallCollisionGroup]);
            //callback for when a snake is destroyed
            snake.addDestroyedCallback(this.snakeDestroyed, this);
            snake.head.body.onBeginContact.add(this.onSnakeWallContact, snake);
            snake.edge.body.onBeginContact.add(this.onSnakeWallContact, snake);
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
            this.processFoodRespawns();
        }

        if (this.phase === 'playing') {
            this.checkSnakeBounds();
            this.resolveSnakeCollisions();
            this.updateScore();
        }
        this.emitLeaderboard();
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
        if (this.restarting) return;
        this.restarting = true;
        try {
            this.releaseBoost();
            if (this.game.physics.p2 && this.game.physics.p2.resume) this.game.physics.p2.resume();
            this.ensureAudio();
            this.playTone(440, 0.08, 'square', 0.025);
            // Reset the phase before destroying the old bodies. That way a
            // stale contact cannot leave the React overlay in game-over.
            this.setPhase('countdown');
            this.countdownT = 3;
            this.lastCount = 4;
            this.initWorld();
            this.isRecord = false;
            this.lastScore = undefined;
            this.graceT = 1.5;
        } finally {
            this.restarting = false;
        }
    },
    /** Explicit replay entry point used by the React game-over overlay. */
    restartGame: function() {
        this.startGame();
    },
    /**
     * Pause or resume the run
     */
    togglePause: function() {
        if (this.phase === 'playing') {
            this.playTone(220, 0.06, 'sine', 0.02);
            this.releaseBoost();
            if (this.player && this.player.setTouchEject) this.player.setTouchEject(false);
            this.setPhase('paused');
            if (this.game.physics.p2 && this.game.physics.p2.pause) this.game.physics.p2.pause();
        }
        else if (this.phase === 'paused') {
            if (this.game.physics.p2 && this.game.physics.p2.resume) this.game.physics.p2.resume();
            for (var i = 0; i < this.game.snakes.length; i++) {
                if (this.game.snakes[i].restoreAfterPause) this.game.snakes[i].restoreAfterPause();
            }
            this.ensureAudio();
            this.playTone(440, 0.06, 'sine', 0.02);
            this.setPhase('playing');
        }
    },
    /**
     * Go back to the menu
     */
    quitToMenu: function() {
        if (this.game.physics.p2 && this.game.physics.p2.resume) this.game.physics.p2.resume();
        this.releaseBoost();
        this.setPhase('menu');
    },
    /**
     * Change the skin color of the player snake
     * @param {Number} color 24-bit hex color
     */
    setPlayerColor: function(color) {
        this.playerColor = color;
        this.playerSkin.base = color;
        if (this.player) {
            this.player.setColor(color);
        }
    },
    createFoodBitmaps: function() {
        var self = this;
        var size = 96;
        var make = function(key, draw) {
            var bmd = self.game.add.bitmapData(size, size);
            var ctx = bmd.ctx || bmd.context;
            ctx.clearRect(0, 0, size, size);
            draw(ctx, size);
            self.game.cache.addBitmapData(key, bmd);
        };
        var circle = function(ctx, color, stroke) {
            ctx.beginPath(); ctx.arc(48, 48, 43, 0, Math.PI * 2);
            ctx.fillStyle = color; ctx.fill();
            if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 4; ctx.stroke(); }
        };
        make('food-hmi', function(ctx) {
            circle(ctx, '#ff6b35', '#ffd166');
            ctx.fillStyle = '#fff'; ctx.font = '800 19px Arial'; ctx.textAlign = 'center'; ctx.fillText('HMI', 48, 55);
        });
        make('food-spotify', function(ctx) {
            circle(ctx, '#1ed760'); ctx.strokeStyle = '#071b12'; ctx.lineWidth = 6; ctx.lineCap = 'round';
            [0, 11, 22].forEach(function(offset) { ctx.beginPath(); ctx.arc(48, 47 + offset, 27 - offset / 2, Math.PI * 1.14, Math.PI * 1.86); ctx.stroke(); });
        });
        make('food-audiomack', function(ctx) {
            circle(ctx, '#111', '#ff4d22'); ctx.fillStyle = '#ff4d22'; ctx.beginPath(); ctx.moveTo(20, 63); ctx.lineTo(35, 30); ctx.lineTo(46, 52); ctx.lineTo(57, 26); ctx.lineTo(77, 63); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = '800 12px Arial'; ctx.textAlign = 'center'; ctx.fillText('AM', 48, 80);
        });
        make('food-apple-music', function(ctx) {
            circle(ctx, '#fa2d48'); ctx.fillStyle = '#fff'; ctx.fillRect(46, 25, 7, 38); ctx.fillRect(51, 25, 22, 6); ctx.beginPath(); ctx.arc(39, 66, 9, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(64, 61, 9, 0, Math.PI * 2); ctx.fill();
        });
        make('food-deezer', function(ctx) {
            circle(ctx, '#221044'); ctx.fillStyle = '#b76cff'; for (var i = 0; i < 5; i++) ctx.fillRect(17 + i * 13, 58 - i * 8, 10, 8 + i * 8);
        });
        make('food-instagram', function(ctx) {
            circle(ctx, '#e1306c', '#ffdc80'); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.strokeRect(27, 27, 42, 42); ctx.beginPath(); ctx.arc(48, 48, 10, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(64, 32, 4, 0, Math.PI * 2); ctx.fill();
        });
        make('food-youtube', function(ctx) {
            ctx.fillStyle = '#ff0033';
            if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(8, 24, 80, 48, 16); ctx.fill(); }
            else { ctx.fillRect(8, 24, 80, 48); }
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(42, 35); ctx.lineTo(65, 48); ctx.lineTo(42, 61); ctx.closePath(); ctx.fill();
        });
        var flame = function(ctx, color, inner) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(53, 7); ctx.bezierCurveTo(57, 25, 48, 28, 62, 38); ctx.bezierCurveTo(83, 54, 78, 88, 48, 89); ctx.bezierCurveTo(16, 89, 12, 64, 39, 39); ctx.bezierCurveTo(42, 55, 50, 53, 53, 7); ctx.fill(); ctx.fillStyle = inner; ctx.beginPath(); ctx.moveTo(50, 44); ctx.bezierCurveTo(67, 57, 64, 76, 50, 78); ctx.bezierCurveTo(35, 78, 34, 64, 50, 44); ctx.fill(); };
        make('food-flame-blue', function(ctx) { flame(ctx, '#2de2ff', '#fff'); });
        make('food-flame-red', function(ctx) { flame(ctx, '#ff3b30', '#ffb020'); });
        make('food-waste', function(ctx) { circle(ctx, '#6d351f', '#ffd166'); ctx.fillStyle = '#9b4d2d'; ctx.beginPath(); ctx.arc(48, 51, 22, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#ffd59e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(48, 43, 16, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); });
    },
    setPlayerSkin: function(skin) {
        if (!skin) return;
        this.playerSkin = {
            name: String(skin.name || 'Skin HMI'),
            id: String(skin.id || skin.frame || '01_neon_cyan'),
            frame: String(skin.frame || skin.id || '01_neon_cyan'),
            base: Number(skin.base) || 0xe23030,
            accent: Number(skin.accent) || 0xffb020,
            style: String(skin.style || 'pulse')
        };
        this.playerColor = this.playerSkin.base;
        if (this.player) this.player.setSkin(this.playerSkin);
    },
    emitLeaderboard: function() {
        if (!this.hud.onLeaderboard || !this.player) return;
        this.boardTimer -= this.game.time.physicsElapsed;
        if (this.boardTimer > 0) return;
        this.boardTimer = 0.25;
        var entries = [{ name: this.playerName || 'Joueur', color: this.playerColor, score: this.getScore() }];
        for (var i = 0; i < this.bots.length; i++) {
            entries.push({ name: this.bots[i].name || ('Bot ' + (i + 1)), color: this.bots[i].color || 0xffffff, score: this.bots[i].snakeLength || 0 });
        }
        entries.sort(function(a, b) { return b.score - a.score; });
        var key = entries.map(function(entry) { return entry.name + ':' + entry.score; }).join('|');
        if (key !== this.lastBoardKey) {
            this.lastBoardKey = key;
            this.hud.onLeaderboard(entries.slice(0, 8));
        }
    },
    setPlayerName: function(name) {
        this.playerName = String(name || 'Joueur').slice(0, 12);
    },
    toggleSound: function() {
        this.soundEnabled = !this.soundEnabled;
        try { localStorage.setItem('koule2d.sound', this.soundEnabled ? 'on' : 'off'); } catch (e) {}
        if (this.soundEnabled) {
            this.ensureAudio();
            this.playTone(660, 0.07, 'sine', 0.02);
        }
        return this.soundEnabled;
    },
    ensureAudio: function() {
        if (!this.soundEnabled || typeof window === 'undefined') return;
        var AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return;
        try {
            if (!this._audioContext) this._audioContext = new AudioCtor();
            if (this._audioContext.state === 'suspended') this._audioContext.resume();
        } catch (e) {}
    },
    playTone: function(frequency, duration, type, volume) {
        if (!this.soundEnabled) return;
        this.ensureAudio();
        var ctx = this._audioContext;
        if (!ctx || ctx.state === 'closed') return;
        try {
            var now = ctx.currentTime;
            var oscillator = ctx.createOscillator();
            var gain = ctx.createGain();
            oscillator.type = type || 'sine';
            oscillator.frequency.setValueAtTime(frequency, now);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(volume || 0.02, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start(now);
            oscillator.stop(now + duration + 0.02);
        } catch (e) {}
    },
    playFoodSound: function() {
        this.playTone(520 + Math.min(this.getScore(), 80) * 3, 0.055, 'triangle', 0.018);
    },
    playDeathSound: function() {
        this.playTone(120, 0.24, 'sawtooth', 0.035);
    },
    playWasteSound: function() {
        this.playTone(170, 0.09, 'square', 0.018);
        this.playTone(105, 0.12, 'triangle', 0.014);
    },
    /**
     * Boost from the mobile UI button
     * @param {Boolean} active whether the boost button is pressed
     */
    setTouchBoost: function(active) {
        this._touchBoost = !!active;
        if (this.player) {
            this.player.setTouchBoost(active);
        }
    },
    releaseBoost: function() {
        this._touchBoost = false;
        if (this.player && this.player.releaseBoost) this.player.releaseBoost();
        else if (this.player) this.player.setTouchBoost(false);
    },
    setTouchEject: function(active) {
        this._touchEject = !!active;
        if (this.player) {
            this.player.setTouchEject(active);
        }
    },
    /**
     * Return the pixel radius used by a section's P2 circle.
     *
     * The old collision check used a fixed 9px square around the player head.
     * That missed fast/large snakes and also made the result depend on the
     * current skin scale. Read the actual shape first, then fall back to the
     * rendered sprite size when a body is being rebuilt.
     */
    getSnakeCollisionRadius: function(snake, section) {
        var body = section && section.body;
        var p2 = this.game.physics && this.game.physics.p2;
        var shape = body && body.data && body.data.shapes && body.data.shapes[0];
        if (shape && typeof shape.radius === 'number' && p2 && p2.mpx) {
            var convertedRadius = p2.mpx(shape.radius);
            if (isFinite(convertedRadius) && convertedRadius > 0) {
                return Math.max(8, Math.min(72, convertedRadius));
            }
        }
        var renderedWidth = section && Number(section.width);
        var scale = snake && Number(snake.scale) || 0.6;
        return Math.max(10, Math.min(72, (renderedWidth > 0 ? renderedWidth : 34 * scale) * 0.5));
    },
    /**
     * Resolve head/body collisions for every snake, not just the player.
     * Sections are kinematic and intentionally do not participate in P2
     * contacts, so this deterministic pass is the authoritative collision
     * rule for the game. All deaths are collected before any snake is
     * destroyed, which makes head-on collisions symmetrical.
     */
    resolveSnakeCollisions: function() {
        if (!this.game.snakes || !this.game.snakes.length) return;

        // Grace period: the player cannot die in the first moments of a replay.
        if (this.graceT === undefined) this.graceT = 1.5;
        this.graceT -= this.game.time.physicsElapsed;

        var snakes = this.game.snakes.slice();
        var dead = [];
        var markDead = function(snake) {
            if (!snake || snake._destroyed || dead.indexOf(snake) >= 0) return;
            dead.push(snake);
        };
        var collides = function(headSnake, headSection, bodySnake, bodySection) {
            if (!headSection || !headSection.body || !bodySection || !bodySection.body) return false;
            var dx = headSection.body.x - bodySection.body.x;
            var dy = headSection.body.y - bodySection.body.y;
            var headRadius = this.getSnakeCollisionRadius(headSnake, headSection);
            var bodyRadius = this.getSnakeCollisionRadius(bodySnake, bodySection);
            var allowed = Math.max(10, headRadius + bodyRadius - 2);
            return dx * dx + dy * dy <= allowed * allowed;
        }.bind(this);

        for (var i = 0; i < snakes.length; i++) {
            var snake = snakes[i];
            if (!snake || snake._destroyed || !snake.head || !snake.head.body) continue;

            // The first sections are physically attached to the head/path and
            // overlap during normal turns. Ignore that short neck, but still
            // catch a real self-intersection farther down the body.
            var selfStart = Math.max(6, Math.ceil(30 / Math.max(1, snake.preferredDistance || 10)));
            for (var selfIndex = selfStart; selfIndex < snake.sections.length; selfIndex++) {
                if (collides(snake, snake.head, snake, snake.sections[selfIndex])) {
                    markDead(snake);
                    break;
                }
            }

            // A snake head entering any other body kills that head. Because
            // every head is checked, head-on collisions kill both snakes.
            var playerProtected = snake.isPlayer && this.graceT > 0;
            if (playerProtected) continue;
            for (var otherIndex = 0; otherIndex < snakes.length; otherIndex++) {
                var other = snakes[otherIndex];
                if (!other || other === snake || other._destroyed || !other.sections) continue;
                for (var sectionIndex = 0; sectionIndex < other.sections.length; sectionIndex++) {
                    if (collides(snake, snake.head, other, other.sections[sectionIndex])) {
                        markDead(snake);
                        break;
                    }
                }
                if (dead.indexOf(snake) >= 0) break;
            }
        }

        for (var deathIndex = 0; deathIndex < dead.length; deathIndex++) {
            var deadSnake = dead[deathIndex];
            if (deadSnake.isPlayer) this.playerDestroyed();
            else if (!deadSnake._destroyed) deadSnake.destroy();
        }
    },
    /** Backwards-compatible alias for older callers. */
    checkPlayerDeath: function() {
        this.resolveSnakeCollisions();
    },
    /**
     * The player snake died: end the run and save the record
     */
    playerDestroyed: function() {
        if (this.restarting || this.phase !== 'playing') {
            return;
        }
        this.playDeathSound();
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
    initFood: function(x, y, variant, kind, tier) {
        var chosenKind = kind || (Math.random() < 0.15 ? 'flame' : 'platform');
        var chosenTier = tier || this.pickFoodTier();
        var safePoint = this.clampFoodPoint(x, y, chosenTier);
        var f = new Food(this.game, safePoint.x, safePoint.y, variant === undefined ? Util.randomInt(0, 2) : variant, chosenKind, chosenTier);
        f.sprite.body.setCollisionGroup(this.foodCollisionGroup);
        this.foodGroup.add(f.sprite);
        f.sprite.body.collides([this.snakeHeadCollisionGroup, this.wallCollisionGroup]);
        return f;
    },
    pickFoodTier: function() {
        var total = 0;
        var weights = [];
        for (var tier = 1; tier <= 10; tier++) {
            var weight = 1 / Math.pow(tier, 1.45);
            weights.push(weight);
            total += weight;
        }
        var roll = Math.random() * total;
        for (var i = 0; i < weights.length; i++) {
            roll -= weights[i];
            if (roll <= 0) return i + 1;
        }
        return 1;
    },
    findFoodSpawnPoint: function(tier) {
        var bounds = this.getFoodBounds(tier);
        var best = null;
        var bestCrowding = Infinity;
        for (var attempt = 0; attempt < 24; attempt++) {
            var candidate = {
                x: Util.randomInt(Math.ceil(bounds.left), Math.floor(bounds.right)),
                y: Util.randomInt(Math.ceil(bounds.top), Math.floor(bounds.bottom))
            };
            var safe = true;
            var snakes = this.game.snakes || [];
            for (var s = 0; s < snakes.length; s++) {
                if (!snakes[s].head || !snakes[s].head.body) continue;
                var dx = snakes[s].head.body.x - candidate.x;
                var dy = snakes[s].head.body.y - candidate.y;
                if (Math.sqrt(dx * dx + dy * dy) < 180 + tier * 8) {
                    safe = false;
                    break;
                }
            }
            if (!safe) continue;
            var crowding = 0;
            for (var f = 0; f < this.foodGroup.children.length; f++) {
                var body = this.foodGroup.children[f].body;
                if (!body) continue;
                var fx = body.x - candidate.x;
                var fy = body.y - candidate.y;
                if (Math.sqrt(fx * fx + fy * fy) < 220) crowding++;
            }
            if (crowding < bestCrowding) {
                best = candidate;
                bestCrowding = crowding;
                if (crowding === 0) break;
            }
        }
        return best || this.clampFoodPoint(0, 0, tier);
    },
    queueFoodRespawn: function(food) {
        if (!food || food.kind === 'waste') return;
        if (!this.foodRespawnQueue) this.foodRespawnQueue = [];
        var tier = Math.max(1, Math.min(10, food.tier || 1));
        var delay;
        if (tier <= 3) delay = 2500 + Math.random() * 2500;
        else if (tier <= 6) delay = 6000 + Math.random() * 4000;
        else delay = 12000 + Math.random() * 8000;
        this.foodRespawnQueue.push({
            readyAt: ((this.game.time && this.game.time.now) || Date.now()) + delay,
            tier: tier,
            variant: food.variant,
            kind: food.kind
        });
    },
    processFoodRespawns: function() {
        if (!this.foodRespawnQueue || !this.foodRespawnQueue.length) return;
        var now = (this.game.time && this.game.time.now) || Date.now();
        if (now < (this.nextFoodSpawnAt || 0)) return;
        if (this.foodGroup.children.length >= (this.targetFoodCount || 0)) return;
        var readyIndex = -1;
        for (var i = 0; i < this.foodRespawnQueue.length; i++) {
            if (this.foodRespawnQueue[i].readyAt <= now) {
                readyIndex = i;
                break;
            }
        }
        if (readyIndex < 0) return;
        var item = this.foodRespawnQueue.splice(readyIndex, 1)[0];
        var point = this.findFoodSpawnPoint(item.tier);
        this.initFood(point.x, point.y, item.variant, item.kind, item.tier);
        this.nextFoodSpawnAt = now + 280;
    },
    checkSnakeBounds: function() {
        var bounds = this.getArenaBounds();
        var margin = (this.wallThickness || 54) + 20;
        var snakes = this.game.snakes.slice();
        for (var i = 0; i < snakes.length; i++) {
            var snake = snakes[i];
            if (!snake || !snake.head || !snake.head.body) continue;
            var x = snake.head.body.x;
            var y = snake.head.body.y;
            if (x <= bounds.left + margin || x >= bounds.right - margin || y <= bounds.top + margin || y >= bounds.bottom - margin) {
                if (snake.isPlayer) this.playerDestroyed();
                else snake.destroy();
            }
        }
    },
    /**
     * Small world snapshot consumed by the React minimap. Body samples make
     * the radar useful for orientation without sending the full Phaser scene
     * through React on every frame.
     */
    getMinimapSnapshot: function() {
        var bounds = this.getArenaBounds();
        var snakes = [];
        var gameSnakes = this.game.snakes || [];
        for (var i = 0; i < gameSnakes.length; i++) {
            var snake = gameSnakes[i];
            if (!snake || !snake.head || !snake.head.body) continue;
            var points = [];
            var step = Math.max(1, Math.ceil((snake.sections || []).length / 20));
            for (var p = 0; p < (snake.sections || []).length; p += step) {
                var section = snake.sections[p];
                if (section && section.body) points.push({ x: section.body.x, y: section.body.y });
            }
            snakes.push({
                name: snake.name || (snake.isPlayer ? 'Joueur' : 'Bot'),
                x: snake.head.body.x,
                y: snake.head.body.y,
                color: snake.isPlayer ? 0xffffff : (snake.skin && snake.skin.base) || snake.color || 0x2de2ff,
                isPlayer: !!snake.isPlayer,
                points: points
            });
        }
        return {
            left: bounds.left,
            right: bounds.right,
            top: bounds.top,
            bottom: bounds.bottom,
            snakes: snakes
        };
    },
    foodCollected: function(food) {
        if (food.kind === 'waste') {
            this.playWasteSound();
            return;
        }
        if (this.particles) {
            this.particles.x = food.sprite.body.x;
            this.particles.y = food.sprite.body.y;
            this.particles.forEach(function(particle) { particle.tint = food.color; }, this);
            this.particles.start(true, 320, null, food.tier >= 7 ? 10 : 6);
        }
        this.queueFoodRespawn(food);
        this.playFoodSound();
    },
    wasteCollected: function(food) {
        if (this.particles) {
            this.particles.x = food.sprite.body.x;
            this.particles.y = food.sprite.body.y;
            this.particles.forEach(function(particle) { particle.tint = 0xffb020; }, this);
            this.particles.start(true, 360, null, 8);
        }
        this.playWasteSound();
    },
    dropWaste: function(snake, amount) {
        if (!snake || snake.snakeLength <= (snake.minLength || 18)) return false;
        var wasteCount = 0;
        for (var i = 0; i < this.foodGroup.children.length; i++) {
            if (this.foodGroup.children[i].food && this.foodGroup.children[i].food.kind === 'waste') wasteCount++;
        }
        if (wasteCount >= 24) return false;
        var tail = snake.sections[snake.sections.length - 1];
        if (!tail) return false;
        var f = this.initFood(
            tail.body.x + Util.randomInt(-12, 12),
            tail.body.y + Util.randomInt(-12, 12),
            1,
            'waste',
            1
        );
        f.value = 0;
        f.shrinkAmount = Math.max(1, Math.min(1, amount || 1));
        snake.shrinkSnake(f.shrinkAmount);
        return true;
    },
    ejectWaste: function() {
        if (!this.player || this.phase !== 'playing') return false;
        return this.player.ejectWaste();
    },
    snakeDestroyed: function(snake) {
        // During replay, old destruction callbacks must not respawn their
        // entire travelled path or trigger a second game-over transition.
        if (this.restarting) return;
        //if the player died through p2 collision, end the run
        if (snake.isPlayer) {
            this.playerDestroyed();
        }
        //place food where snake was destroyed
        var step = Math.max(1, Math.round(snake.headPath.length / Math.max(1, snake.snakeLength)) * 2);
        for (var i = 0 ; i < snake.headPath.length ; i += step) {
            this.initFood(
                snake.headPath[i].x + Util.randomInt(-10,10),
                snake.headPath[i].y + Util.randomInt(-10,10)
            );
        }
    }
};
