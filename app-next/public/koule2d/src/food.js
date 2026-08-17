/**
 * Collectible music token.
 * platform = logo token, flame = high-value token, waste = toxic ejection.
 */
Food = function(game, x, y, variant, kind, tier) {
    this.game = game;
    this.variant = variant || 0;
    this.kind = kind || 'platform';
    this.tier = Math.max(1, Math.min(10, Number(tier) || 1));
    this.shrinkAmount = 2;

    var platformKeys = ['food-hmi-real', 'food-spotify-real', 'food-audiomack-real', 'food-apple-music', 'food-deezer-real', 'food-tiktok-real', 'food-music-real'];
    var key = 'food';
    if (this.kind === 'waste') key = 'food-waste-real';
    else if (this.kind === 'flame') key = this.variant % 2 ? 'food-flame-red-real' : 'food-flame-blue-real';
    else if (this.kind === 'platform') key = platformKeys[Util.randomInt(0, platformKeys.length - 1)];

    // Tiers 1–10 map to readable nutrition rather than one huge jump.
    this.nutrition = this.kind === 'waste' ? 0 : (this.kind === 'flame' ? Math.max(3, Math.ceil(this.tier / 2)) : Math.max(1, Math.ceil(this.tier / 3)));
    this.value = this.nutrition;
    this.color = this.kind === 'waste' ? 0x9b4d2d : (this.kind === 'flame' ? (this.variant % 2 ? 0xff3b30 : 0x2de2ff) : (this.variant === 2 ? 0xffc857 : (this.variant === 1 ? 0x35e6ff : 0xff4fd8)));
    this.debug = false;
    var bitmap = this.game.cache.getBitmapData ? this.game.cache.getBitmapData(key) : null;
    this.sprite = this.game.add.sprite(x, y, bitmap || key);
    this.sprite.tint = this.kind === 'platform' || this.kind === 'waste' ? 0xffffff : this.color;
    var tierScale = 0.30 + this.tier * 0.025;
    this.sprite.scale.setTo(key.indexOf('-real') >= 0 ? (this.kind === 'waste' ? 0.42 : tierScale) : (this.kind === 'waste' ? 0.5 : (this.kind === 'flame' ? 0.68 + this.tier * 0.012 : tierScale)));

    this.game.physics.p2.enable(this.sprite, this.debug);
    this.sprite.body.clearShapes();
    this.sprite.body.addCircle(this.sprite.width * 0.5);
    this.sprite.body.onBeginContact.add(this.onBeginContact, this);
    this.sprite.food = this;
    this.sprite.name = 'food';

    this.head = null;
    this.constraint = null;
};

Food.prototype = {
    onBeginContact: function(phaserBody) {
        if (phaserBody && phaserBody.sprite && phaserBody.sprite.name === 'head' && this.constraint === null) {
            this.sprite.body.collides([]);
            this.constraint = this.game.physics.p2.createRevoluteConstraint(
                this.sprite.body, [0, 0], phaserBody, [0, 0]
            );
            this.head = phaserBody.sprite;
            this.head.snake.food.push(this);
        }
    },
    update: function() {
        this.sprite.angle += this.kind === 'waste' ? 1.7 : (this.kind === 'flame' ? 1.4 : 0.7);
        if (this.head && Math.round(this.head.body.x) === Math.round(this.sprite.body.x) &&
            Math.round(this.head.body.y) === Math.round(this.sprite.body.y)) {
            var state = this.game.state.getCurrentState();
            var snake = this.head.snake;
            if (this.kind === 'waste') {
                if (state && state.wasteCollected) state.wasteCollected(this);
                snake.shrinkSnake(this.shrinkAmount);
            } else {
                if (state && state.foodCollected) state.foodCollected(this);
                for (var i = 0; i < this.value; i++) snake.incrementSize();
            }
            this.destroy();
        }
    },
    destroy: function() {
        if (this.constraint) this.game.physics.p2.removeConstraint(this.constraint);
        if (this.head && this.head.snake && this.head.snake.food) {
            var index = this.head.snake.food.indexOf(this);
            if (index >= 0) this.head.snake.food.splice(index, 1);
        }
        this.constraint = null;
        this.head = null;
        if (this.sprite && this.sprite.destroy) this.sprite.destroy();
    }
};
