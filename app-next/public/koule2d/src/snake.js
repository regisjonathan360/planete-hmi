/**
 * Phaser snake
 * @param  {Phaser.Game} game      game object
 * @param  {String} spriteKey Phaser sprite key
 * @param  {Number} x         coordinate
 * @param  {Number} y         coordinate
 */
Snake = function(game, spriteKey, x, y, initialSections) {
    this.game = game;
    //create an array of snakes in the game object and add this snake
    if (!this.game.snakes) {
        this.game.snakes = [];
    }
    this.game.snakes.push(this);
    this.debug = false;
    this.snakeLength = 0;
    this.spriteKey = spriteKey;
    this.minLength = 18;
    this.boosting = false;
    this.boostCostTimer = 0.45;
    this.wasteTimer = 2;
    this.ejectCooldown = 0;
    this.initialSections = Math.max(this.minLength, Number(initialSections) || 30);
    this.skin = { id: '01_neon_cyan', frame: '01_neon_cyan', name: 'Neon Cyan', base: 0x0ff0ff, accent: 0x006bff, style: 'pulse' };

    //various quantities that can be changed
    this.scale = 0.6;
    // Boost clearly faster than cruise speed, while still leaving room for
    // steering and wall avoidance.
    this.fastSpeed = 360;
    this.slowSpeed = 156;
    this.speed = this.slowSpeed;
    //base rotation in degrees per second and rotation gained per
    //unit of speed, so that turning stays sharp when boosting
    this.baseRotation = 80;
    this.rotationSpeedFactor = 0.4;

    //initialize groups and arrays
    this.collisionGroup = this.game.physics.p2.createCollisionGroup();
    this.sections = [];
    //the head path is an array of points that the head of the snake has
    //traveled through
    this.headPath = [];
    this.food = [];

    this.preferredDistance = 17 * this.scale;
    this.queuedSections = 0;

    //initialize the shadow
    this.shadow = new Shadow(this.game, this.sections, this.scale);
    this.sectionGroup = this.game.add.group();
    //add the head of the snake
    this.head = this.addSectionAtPosition(x,y);
    this.head.name = "head";
    this.head.snake = this;

    this.lastHeadPosition = new Phaser.Point(this.head.body.x, this.head.body.y);
    //add 30 sections behind the head
    this.initSections(this.initialSections);

    //initialize the eyes
    this.eyes = new EyePair(this.game, this.head, this.scale);

    //the edge is the front body that can collide with other snakes
    //it is locked to the head of this snake
    this.edgeOffset = 4;
    this.edge = this.game.add.sprite(x, y - this.edgeOffset, this.spriteKey);
    this.edge.name = "edge";
    this.edge.alpha = 0;
    this.game.physics.p2.enable(this.edge, this.debug);
    this.edge.body.setCircle(this.edgeOffset);

    //constrain edge to the front of the head
    this.edgeLock = this.game.physics.p2.createLockConstraint(
        this.edge.body, this.head.body, [0, -this.head.width*0.5-this.edgeOffset]
    );

    this.edge.body.onBeginContact.add(this.edgeContact, this);

    this.onDestroyedCallbacks = [];
    this.onDestroyedContexts = [];
    this._destroyed = false;
}

Snake.prototype = {
    /**
     * Give the snake starting segments
     * @param  {Number} num number of snake sections to create
     */
    initSections: function(num) {
        //create a certain number of sections behind the head
        //only use this once
        for (var i = 1 ; i <= num ; i++) {
            var x = this.head.body.x;
            var y = this.head.body.y + i * this.preferredDistance;
            this.addSectionAtPosition(x, y);
            //add a point to the head path so that the section stays there
            this.headPath.push(new Phaser.Point(x,y));
        }

    },
    /**
     * Rotation speed in degrees per second, which grows with the snake's
     * speed so that turning stays sharp when boosting
     * @return {Number} rotation speed in degrees per second
     */
    getRotationSpeed: function() {
        return this.baseRotation + this.rotationSpeedFactor * this.speed;
    },
    /**
     * Color of the snake body (24-bit hex) applied to every section
     * @param {Number} color 24-bit hex color
     */
    setColor: function(color) {
        this.color = color;
        this.skin.base = color;
        for (var i = 0 ; i < this.sections.length ; i++) {
            this.sections[i].tint = color;
        }
    },
    setSkin: function(skin) {
        if (!skin) return;
        this.skin = {
            id: String(skin.id || skin.frame || '01_neon_cyan'),
            frame: String(skin.frame || skin.id || '01_neon_cyan'),
            name: String(skin.name || 'Skin HMI'),
            base: Number(skin.base) || 0xe23030,
            accent: Number(skin.accent) || 0xffb020,
            style: String(skin.style || 'pulse')
        };
        this.color = this.skin.base;
        this.refreshSkinTextures();
    },
    refreshSkinTextures: function() {
        for (var i = 0; i < this.sections.length; i++) {
            this.applySkinTexture(this.sections[i], i);
            this.sections[i].tint = this.getSectionTint(i);
        }
        this.setScale(this.scale);
    },
    restoreAfterPause: function() {
        // Phaser can leave overlap-hidden sections at alpha 0 after a long
        // pause. Restore every live section without changing snakeLength or
        // scale, then redraw the visual helpers.
        for (var i = 0; i < this.sections.length; i++) {
            if (!this.sections[i] || !this.sections[i].body) continue;
            this.sections[i].visible = true;
            this.sections[i].alpha = 1;
        }
        this.refreshSkinTextures();
        if (this.eyes) this.eyes.update();
        if (this.shadow) this.shadow.update();
    },
    applySkinTexture: function(section, index) {
        if (!this.skin || !this.skin.frame || !section || !section.loadTexture) return;
        try {
            if (index === 0) section.loadTexture('skin-head-atlas', this.skin.frame);
            else if (index === this.sections.length - 1) section.loadTexture('skin-tail-atlas', this.skin.frame);
            else section.loadTexture('skin-body-atlas', this.skin.frame);
            section.anchor.setTo(0.5, 0.5);
        } catch (e) {
            /* Fallback to the legacy circle texture if an atlas is unavailable. */
        }
    },
    getSectionTint: function(index) {
        if (!this.skin) return this.color || 0xe23030;
        if (this.skin.style === 'stripe' && index % 4 < 2) return this.skin.accent;
        if (this.skin.style === 'pulse' && index % 7 === 0) return this.skin.accent;
        return this.skin.base;
    },
    /**
     * Boost on/off from an external UI (mobile touch button)
     * @param {Boolean} active whether the boost should be active
     */
    setTouchBoost: function(active) {
        this.setBoosting(active);
    },
    setBoosting: function(active) {
        this.touchBoost = !!active;
        this.boosting = !!active;
        this.speed = this.boosting ? this.fastSpeed : this.slowSpeed;
        if (!this.boosting) {
            this.boostCostTimer = 0.45;
            this.wasteTimer = this.randomWasteInterval();
        }
        if (this.shadow) this.shadow.isLightingUp = this.boosting;
    },
    setTouchEject: function(active) {
        this.touchEject = !!active;
    },
    handleBoostEconomy: function() {
        var state = this.game.state.getCurrentState();
        if (!state || state.phase !== 'playing') return;
        this.ejectCooldown = Math.max(0, this.ejectCooldown - this.game.time.physicsElapsed);
        if (!this.boosting) return;
        this.boostCostTimer -= this.game.time.physicsElapsed;
        this.wasteTimer -= this.game.time.physicsElapsed;
        if (this.wasteTimer <= 0) {
            this.wasteTimer = this.randomWasteInterval();
            if (this.snakeLength > this.minLength + 4) state.dropWaste(this, 1);
        }
    },
    randomWasteInterval: function() {
        var roll = Math.random();
        if (roll < 0.06) return 0.2;
        if (roll < 0.28) return 2;
        if (roll < 0.62) return 5;
        if (roll < 0.84) return 8;
        if (roll < 0.96) return 12;
        return 20;
    },
    ejectWaste: function() {
        var state = this.game.state.getCurrentState();
        if (!state || state.phase !== 'playing' || this.ejectCooldown > 0 || this.snakeLength <= this.minLength + 4) return false;
        this.ejectCooldown = Math.max(0.8, this.randomWasteInterval());
        return state.dropWaste(this, 1);
    },
    /**
     * Add a section to the snake at a given position
     * @param  {Number} x coordinate
     * @param  {Number} y coordinate
     * @return {Phaser.Sprite}   new section
     */
    addSectionAtPosition: function(x, y) {
        //initialize a new section
        var sec = this.game.add.sprite(x, y, this.spriteKey);
        this.game.physics.p2.enable(sec, this.debug);
        sec.body.setCollisionGroup(this.collisionGroup);
        sec.body.collides([]);
        sec.body.kinematic = true;

        this.snakeLength++;
        this.sectionGroup.add(sec);
        sec.sendToBack();
        sec.scale.setTo(this.scale);
        if (this.color !== undefined) {
            sec.tint = this.color;
        }

        this.sections.push(sec);

        this.shadow.add(x,y);
        //add a circle body to this section
        sec.body.clearShapes();
        sec.body.addCircle(sec.width*0.5);
        sec.tint = this.getSectionTint(this.sections.length - 1);

        return sec;
    },
    /**
     * Add to the queue of new sections
     * @param  {Integer} amount Number of sections to add to queue
     */
    addSectionsAfterLast: function(amount) {
        this.queuedSections += amount;
    },
    /**
     * Call from the main update loop
     */
    update: function() {
        this.handleBoostEconomy();
        var speed = this.speed;
        this.head.body.moveForward(speed);

        //remove the last element of an array that contains points which
        //the head traveled through
        //then move this point to the front of the array and change its value
        //to be where the head is located
        var point = this.headPath.pop();
        point.setTo(this.head.body.x, this.head.body.y);
        this.headPath.unshift(point);

        //place each section of the snake on the path of the snake head,
        //a certain distance from the section before it
        var index = 0;
        var lastIndex = null;
        for (var i = 0 ; i < this.snakeLength ; i++) {

            this.sections[i].body.x = this.headPath[index].x;
            this.sections[i].body.y = this.headPath[index].y;

            //hide sections if they are at the same position
            if (lastIndex && index == lastIndex) {
                this.sections[i].alpha = 0;
            }
            else {
                this.sections[i].alpha = 1;
            }

            lastIndex = index;
            //this finds the index in the head path array that the next point
            //should be at
            index = this.findNextPointIndex(index);
        }

        //continuously adjust the size of the head path array so that we
        //keep only an array of points that we need
        if (index >= this.headPath.length - 1) {
            var lastPos = this.headPath[this.headPath.length - 1];
            this.headPath.push(new Phaser.Point(lastPos.x, lastPos.y));
        }
        else {
            this.headPath.pop();
        }

        //this calls onCycleComplete every time a cycle is completed
        //a cycle is the time it takes the second section of a snake to reach
        //where the head of the snake was at the end of the last cycle
        var i = 0;
        var found = false;
        while (i < this.headPath.length && this.sections.length > 1 &&
        (this.headPath[i].x != this.sections[1].body.x ||
        this.headPath[i].y != this.sections[1].body.y)) {
            if (this.headPath[i].x == this.lastHeadPosition.x &&
            this.headPath[i].y == this.lastHeadPosition.y) {
                found = true;
                break;
            }
            i++;
        }
        if (!found && this.headPath.length) {
            this.lastHeadPosition = new Phaser.Point(this.head.body.x, this.head.body.y);
            this.onCycleComplete();
        }

        //update the eyes and the shadow below the snake
        this.eyes.update();
        this.shadow.update();
    },
    /**
     * Find in the headPath array which point the next section of the snake
     * should be placed at, based on the distance between points
     * @param  {Integer} currentIndex Index of the previous snake section
     * @return {Integer}              new index
     */
    findNextPointIndex: function(currentIndex) {
        var pt = this.headPath[currentIndex];
        //we are trying to find a point at approximately this distance away
        //from the point before it, where the distance is the total length of
        //all the lines connecting the two points
        var prefDist = this.preferredDistance;
        var len = 0;
        var dif = len - prefDist;
        var i = currentIndex;
        var prevDif = null;
        //this loop sums the distances between points on the path of the head
        //starting from the given index of the function and continues until
        //this sum nears the preferred distance between two snake sections
        while (i+1 < this.headPath.length && (dif === null || dif < 0)) {
            //get distance between next two points
            var dist = Util.distanceFormula(
                this.headPath[i].x, this.headPath[i].y,
                this.headPath[i+1].x, this.headPath[i+1].y
            );
            len += dist;
            prevDif = dif;
            //we are trying to get the difference between the current sum and
            //the preferred distance close to zero
            dif = len - prefDist;
            i++;
        }

        //choose the index that makes the difference closer to zero
        //once the loop is complete
        if (prevDif === null || Math.abs(prevDif) > Math.abs(dif)) {
            return i;
        }
        else {
            return i-1;
        }
    },
    /**
     * Called each time the snake's second section reaches where the
     * first section was at the last call (completed a single cycle)
     */
    onCycleComplete: function() {
        if (this.queuedSections > 0) {
            var lastSec = this.sections[this.sections.length - 1];
            this.addSectionAtPosition(lastSec.body.x, lastSec.body.y);
            this.queuedSections--;
            this.refreshSkinTextures();
        }
    },
    /**
     * Set snake scale
     * @param  {Number} scale Scale
     */
    setScale: function(scale) {
        this.scale = scale;
        this.preferredDistance = 17 * this.scale;

        //update edge lock location with p2 physics
        this.edgeLock.localOffsetB = [
            0, this.game.physics.p2.pxmi(this.head.width*0.5+this.edgeOffset)
        ];

        //scale sections and their bodies
        for (var i = 0 ; i < this.sections.length ; i++) {
            var sec = this.sections[i];
            sec.scale.setTo(this.scale);
            sec.body.data.shapes[0].radius = this.game.physics.p2.pxm(sec.width*0.5);
            if (this.color !== undefined) sec.tint = this.getSectionTint(i);
        }

        //scale eyes and shadows
        this.eyes.setScale(scale);
        this.shadow.setScale(scale);
    },
    /**
     * Increment length and scale
     */
    incrementSize: function() {
        this.addSectionsAfterLast(1);
        // A food token should make the snake feel rewarded without causing
        // exponential visual growth after only a few seconds.
        this.setScale(this.scale * 1.003);
    },
    shrinkSnake: function(amount) {
        var removed = 0;
        var count = Math.max(1, Math.floor(amount || 1));
        while (removed < count && this.sections.length > this.minLength) {
            var sec = this.sections.pop();
            if (sec) sec.destroy();
            if (this.shadow && this.shadow.removeLast) this.shadow.removeLast();
            removed++;
        }
        this.snakeLength = this.sections.length;
        if (removed > 0) {
            this.setScale(Math.max(0.48, this.scale / Math.pow(1.003, removed)));
        }
        return removed;
    },
    /**
     * Destroy the snake
     */
    destroy: function() {
        if (this._destroyed) return;
        this._destroyed = true;
        var snakeIndex = this.game.snakes.indexOf(this);
        if (snakeIndex >= 0) this.game.snakes.splice(snakeIndex, 1);
        //remove constraints
        this.game.physics.p2.removeConstraint(this.edgeLock);
        this.edge.destroy();
        //destroy food that is constrained to the snake head
        for (var i = this.food.length - 1 ; i >= 0 ; i--) {
            this.food[i].destroy();
        }
        //destroy everything else
        this.sections.forEach(function(sec, index) {
            sec.destroy();
        });
        this.eyes.destroy();
        this.shadow.destroy();

        //call this snake's destruction callbacks
        for (var i = 0 ; i < this.onDestroyedCallbacks.length ; i++) {
            if (typeof this.onDestroyedCallbacks[i] == "function") {
                this.onDestroyedCallbacks[i].apply(
                    this.onDestroyedContexts[i], [this]);
            }
        }
    },
    /**
     * Called when the front of the snake (the edge) hits something
     * @param  {Phaser.Physics.P2.Body} phaserBody body it hit
     */
    edgeContact: function(phaserBody) {
        // Wall contacts are handled by Game.onSnakeWallContact and the
        // logical bounds pass. Do not let a missing sprite on a static P2
        // body look like an arbitrary snake collision.
        if (!phaserBody || phaserBody.isArenaWall) return;
        // If a future collision body is one of this snake's own sections,
        // move the edge back to the head to avoid a lock-constraint glitch.
        if (this.sections.indexOf(phaserBody.sprite) >= 0) {
            this.edge.body.x = this.head.body.x;
            this.edge.body.y = this.head.body.y;
        }
    },
    /**
     * Add callback for when snake is destroyed
     * @param  {Function} callback Callback function
     * @param  {Object}   context  context of callback
     */
    addDestroyedCallback: function(callback, context) {
        this.onDestroyedCallbacks.push(callback);
        this.onDestroyedContexts.push(context);
    }
};
