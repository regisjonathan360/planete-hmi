/**
 * HMI Snake bot controller.
 *
 * The controller is deliberately deterministic and lightweight: it uses the
 * sector perception / food-cluster ideas from the Slither.io-bot research
 * folder, then adds predictive time-to-collision checks and a small candidate
 * heading search. It is not a copied userscript; it is adapted to this
 * Phaser/P2 world where every snake is a live physics object.
 */
BotSnake = function(game, spriteKey, x, y, initialSections, profile) {
    Snake.call(this, game, spriteKey, x, y, initialSections);
    this.profile = profile || 'scavenger';
    this.behaviour = 'forage';
    this.thinkTimer = 0;
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.target = null;
    this.targetPoint = null;
    this.attackPlan = null;
    this.threat = null;
    this.perception = null;
    this.boostLockedUntil = 0;
    this.lastHeadX = x;
    this.lastHeadY = y;
    this.velocityX = 0;
    this.velocityY = 0;
};

BotSnake.prototype = Object.create(Snake.prototype);
BotSnake.prototype.constructor = BotSnake;

BotSnake.PROFILES = {
    scavenger: {
        foodWeight: 1.35,
        dangerWeight: 1.35,
        attackWeight: 0,
        attackAdvantage: 1.45,
        risk: 1.45,
        thinkMin: 0.20,
        thinkJitter: 0.16
    },
    defender: {
        foodWeight: 1.05,
        dangerWeight: 1.75,
        attackWeight: 0,
        attackAdvantage: 1.60,
        risk: 1.85,
        thinkMin: 0.18,
        thinkJitter: 0.14
    },
    opportunist: {
        foodWeight: 1.20,
        dangerWeight: 1.45,
        attackWeight: 1.20,
        attackAdvantage: 1.28,
        risk: 1.15,
        thinkMin: 0.18,
        thinkJitter: 0.14
    },
    hunter: {
        foodWeight: 1.00,
        dangerWeight: 1.25,
        attackWeight: 1.55,
        attackAdvantage: 1.18,
        risk: 0.95,
        thinkMin: 0.16,
        thinkJitter: 0.12
    }
};

BotSnake.prototype.tempUpdate = BotSnake.prototype.update;

BotSnake.prototype.update = function() {
    var state = this.game.state.getCurrentState();
    var phase = state && state.phase;
    var dt = Math.max(0.016, Number(this.game.time.physicsElapsed) || 0.016);
    var head = this.head && this.head.body;

    if (!head || phase !== 'playing') {
        if (this.boosting) this.setBoosting(false);
        this.tempUpdate();
        return;
    }

    this.updateVelocityEstimate(head, dt);
    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0 || !this.perception) {
        var profile = BotSnake.PROFILES[this.profile] || BotSnake.PROFILES.scavenger;
        this.thinkTimer = profile.thinkMin + Math.random() * profile.thinkJitter;
        this.perception = this.scanPerception(state);
        this.decide(state, this.perception);
    }

    var direction = this.chooseDirection(state, this.perception);
    if (direction) this.turnToward(direction.x, direction.y);
    this.updateBoost(state, this.perception);
    this.tempUpdate();
};

BotSnake.prototype.updateVelocityEstimate = function(head, dt) {
    var dx = head.x - this.lastHeadX;
    var dy = head.y - this.lastHeadY;
    var measuredX = dx / dt;
    var measuredY = dy / dt;
    // Smooth the estimate because P2 can report a very small first-frame jump.
    this.velocityX = this.velocityX * 0.65 + measuredX * 0.35;
    this.velocityY = this.velocityY * 0.65 + measuredY * 0.35;
    this.lastHeadX = head.x;
    this.lastHeadY = head.y;
};

BotSnake.prototype.getProfile = function() {
    return BotSnake.PROFILES[this.profile] || BotSnake.PROFILES.scavenger;
};

BotSnake.prototype.clamp = function(value, min, max) {
    return Math.max(min, Math.min(max, value));
};

BotSnake.prototype.distance = function(dx, dy) {
    return Math.sqrt(dx * dx + dy * dy);
};

BotSnake.prototype.normalize = function(x, y) {
    var length = this.distance(x, y) || 1;
    return { x: x / length, y: y / length };
};

BotSnake.prototype.dot = function(ax, ay, bx, by) {
    return ax * bx + ay * by;
};

BotSnake.prototype.headingVector = function(angle) {
    // Keep the same angle convention as PlayerSnake.steerToDirection.
    // The game uses P2 angles in degrees, while this helper receives radians.
    var degrees = angle * 180 / Math.PI;
    var rawDegrees = degrees > 0 ? 180 - degrees : -180 - degrees;
    var raw = rawDegrees * Math.PI / 180;
    return { x: Math.sin(raw), y: Math.cos(raw) };
};

BotSnake.prototype.angleForVector = function(x, y) {
    var degrees = 180 * Math.atan2(x, y) / Math.PI;
    if (degrees > 0) degrees = 180 - degrees;
    else degrees = -180 - degrees;
    return degrees * Math.PI / 180;
};

BotSnake.prototype.getBodyRadius = function(snake, section) {
    var scale = snake && snake.scale ? snake.scale : 0.6;
    var width = section && section.width ? section.width : 34;
    return Math.max(14, Math.min(52, width * scale * 0.48));
};

BotSnake.prototype.getVelocity = function(snake) {
    if (snake === this) return { x: this.velocityX, y: this.velocityY };
    var body = snake && snake.head && snake.head.body;
    if (body && body.velocity && typeof body.velocity[0] === 'number') {
        return { x: body.velocity[0], y: body.velocity[1] };
    }
    if (body && typeof body.angle === 'number') {
        var heading = this.headingVector(body.angle * Math.PI / 180);
        var speed = snake && snake.speed ? snake.speed : 150;
        return { x: heading.x * speed, y: heading.y * speed };
    }
    return { x: 0, y: 0 };
};

BotSnake.prototype.getSector = function(dx, dy, sectorCount) {
    var angle = Math.atan2(dx, dy);
    if (angle < 0) angle += Math.PI * 2;
    return Math.floor(angle / (Math.PI * 2) * sectorCount) % sectorCount;
};

BotSnake.prototype.getSectorDistance = function(perception, direction) {
    if (!perception || !perception.sectors) return 9999;
    var sector = this.getSector(direction.x, direction.y, perception.sectorCount);
    return perception.sectors[sector].obstacleDistance;
};

/**
 * Build a compact 24-sector view around the bot. Every sector records the
 * closest body/wall and the closest food cluster, while hazards also retain
 * enough motion data for a time-to-collision test.
 */
BotSnake.prototype.scanPerception = function(state) {
    var sectorCount = 24;
    var radius = 1320;
    var head = this.head.body;
    var perception = {
        sectorCount: sectorCount,
        radius: radius,
        sectors: [],
        hazards: [],
        foodClusters: [],
        nearestThreat: null
    };
    var i;
    for (i = 0; i < sectorCount; i++) {
        perception.sectors.push({ obstacleDistance: radius, foodValue: 0, hazard: null });
    }

    var snakes = this.game.snakes || [];
    for (i = 0; i < snakes.length; i++) {
        var other = snakes[i];
        if (!other || other === this || !other.sections || !other.head || !other.head.body) continue;
        var enemyVelocity = this.getVelocity(other);
        var sections = other.sections;
        // Sample the body regularly. The head is always included because it is
        // the most useful moving obstacle for an attack/defence decision.
        var step = Math.max(1, Math.ceil(sections.length / 16));
        for (var s = 0; s < sections.length; s += step) {
            var section = sections[s];
            if (!section || !section.body) continue;
            this.addHazard(perception, other, section, enemyVelocity, false, head);
        }
        this.addHazard(perception, other, other.head, enemyVelocity, true, head);
    }

    var foodGroup = state && state.foodGroup;
    var buckets = {};
    var cellSize = 210;
    if (foodGroup && foodGroup.children) {
        for (i = 0; i < foodGroup.children.length; i++) {
            var sprite = foodGroup.children[i];
            var food = sprite && sprite.food;
            if (!food || !sprite.body || food.head || food.kind === 'waste') continue;
            var foodDx = sprite.body.x - head.x;
            var foodDy = sprite.body.y - head.y;
            var foodDistance = this.distance(foodDx, foodDy);
            if (foodDistance > radius) continue;
            var bx = Math.floor(sprite.body.x / cellSize);
            var by = Math.floor(sprite.body.y / cellSize);
            var key = bx + '|' + by;
            if (!buckets[key]) {
                buckets[key] = {
                    x: 0,
                    y: 0,
                    nutrition: 0,
                    count: 0,
                    bestFood: food,
                    bestValue: -Infinity
                };
            }
            var bucket = buckets[key];
            bucket.x += sprite.body.x;
            bucket.y += sprite.body.y;
            bucket.nutrition += Math.max(1, food.nutrition || food.value || 1);
            bucket.count++;
            if ((food.nutrition || food.value || 1) > bucket.bestValue) {
                bucket.bestValue = food.nutrition || food.value || 1;
                bucket.bestFood = food;
            }
        }
    }

    for (var bucketKey in buckets) {
        if (!Object.prototype.hasOwnProperty.call(buckets, bucketKey)) continue;
        var cluster = buckets[bucketKey];
        cluster.x /= cluster.count;
        cluster.y /= cluster.count;
        cluster.dx = cluster.x - head.x;
        cluster.dy = cluster.y - head.y;
        cluster.distance = this.distance(cluster.dx, cluster.dy);
        cluster.angle = this.angleForVector(cluster.dx, cluster.dy);
        cluster.sector = this.getSector(cluster.dx, cluster.dy, sectorCount);
        cluster.value = cluster.nutrition * (1 + Math.min(0.7, (cluster.count - 1) * 0.08));
        var clusterSector = perception.sectors[cluster.sector];
        clusterSector.foodValue = Math.max(clusterSector.foodValue, cluster.value);
        perception.foodClusters.push(cluster);
    }

    perception.foodClusters.sort(function(a, b) { return b.value - a.value; });
    perception.hazards.sort(function(a, b) {
        var at = isFinite(a.ttc) ? a.ttc : 99;
        var bt = isFinite(b.ttc) ? b.ttc : 99;
        return at - bt || a.distance - b.distance;
    });
    perception.nearestThreat = this.findImmediateThreat(perception.hazards);
    return perception;
};

BotSnake.prototype.addHazard = function(perception, other, section, velocity, isHead, head) {
    var dx = section.body.x - head.x;
    var dy = section.body.y - head.y;
    var distance = this.distance(dx, dy);
    if (distance > perception.radius) return;
    var unit = this.normalize(dx, dy);
    var radius = this.getBodyRadius(other, section) + this.getBodyRadius(this, this.head) + 30;
    var approach = this.dot(velocity.x, velocity.y, -unit.x, -unit.y);
    var sector = this.getSector(dx, dy, perception.sectorCount);
    var hazard = {
        snake: other,
        section: section,
        x: section.body.x,
        y: section.body.y,
        dx: dx,
        dy: dy,
        distance: distance,
        radius: radius,
        velocityX: velocity.x,
        velocityY: velocity.y,
        approach: approach,
        sector: sector,
        isHead: !!isHead,
        ttc: Infinity
    };
    // Initial TTC is evaluated against the current heading. Candidate paths
    // are checked again later, because changing direction changes the result.
    var current = this.headingVector(this.head.body.angle * Math.PI / 180);
    hazard.ttc = this.timeToCollision(hazard, current, this.speed || this.slowSpeed, 2.8);
    perception.hazards.push(hazard);
    var sectorData = perception.sectors[sector];
    if (distance < sectorData.obstacleDistance) {
        sectorData.obstacleDistance = distance;
        sectorData.hazard = hazard;
    }
};

BotSnake.prototype.findImmediateThreat = function(hazards) {
    for (var i = 0; i < hazards.length; i++) {
        var hazard = hazards[i];
        if (hazard.distance < 180 || hazard.ttc < 1.35 || (hazard.isHead && hazard.approach > 115 && hazard.distance < 520)) {
            return hazard;
        }
    }
    return null;
};

BotSnake.prototype.timeToCollision = function(hazard, direction, speed, horizon) {
    var distance = hazard.distance;
    if (distance <= hazard.radius) return 0;
    var relativeX = hazard.velocityX - direction.x * speed;
    var relativeY = hazard.velocityY - direction.y * speed;
    var relativeSpeed2 = relativeX * relativeX + relativeY * relativeY;
    if (relativeSpeed2 < 1) return Infinity;
    var t = -(hazard.dx * relativeX + hazard.dy * relativeY) / relativeSpeed2;
    if (t < 0 || t > horizon) return Infinity;
    var closestX = hazard.dx + relativeX * t;
    var closestY = hazard.dy + relativeY * t;
    var closestDistance = this.distance(closestX, closestY);
    return closestDistance <= hazard.radius ? t : Infinity;
};

BotSnake.prototype.findThreat = function(perception) {
    return perception && perception.nearestThreat ? perception.nearestThreat : null;
};

BotSnake.prototype.findAttackPlan = function(perception) {
    var profile = this.getProfile();
    if (!profile.attackWeight || this.snakeLength < 30) return null;
    var snakes = this.game.snakes || [];
    var head = this.head.body;
    var best = null;
    var bestScore = -Infinity;
    for (var i = 0; i < snakes.length; i++) {
        var other = snakes[i];
        if (!other || other === this || !other.head || !other.head.body) continue;
        var otherLength = other.snakeLength || 0;
        if (otherLength <= 0 || this.snakeLength < otherLength * profile.attackAdvantage) continue;
        var dx = other.head.body.x - head.x;
        var dy = other.head.body.y - head.y;
        var distance = this.distance(dx, dy);
        if (distance < 260 || distance > 1100) continue;
        var otherVelocity = this.getVelocity(other);
        var targetHeading = this.normalize(otherVelocity.x, otherVelocity.y);
        var lead = this.clamp(distance / Math.max(this.speed || this.slowSpeed, 1), 0.45, 1.45);
        var futureX = other.head.body.x + otherVelocity.x * lead;
        var futureY = other.head.body.y + otherVelocity.y * lead;
        // Cut across the target's route rather than steering head-on into it.
        var side = this.dot(dx, dy, -targetHeading.y, targetHeading.x) >= 0 ? 1 : -1;
        var lateralX = -targetHeading.y * side;
        var lateralY = targetHeading.x * side;
        var goal = {
            x: futureX + targetHeading.x * 210 + lateralX * 190,
            y: futureY + targetHeading.y * 210 + lateralY * 190
        };
        var danger = 0;
        for (var h = 0; h < perception.hazards.length; h++) {
            var hazard = perception.hazards[h];
            if (hazard.snake !== other || hazard.isHead) continue;
            if (hazard.distance < 360) danger += (360 - hazard.distance) / 360;
        }
        var advantage = this.snakeLength / Math.max(otherLength, 1);
        var score = advantage * 160 - distance * 0.16 - danger * 220;
        if (other.isPlayer) score += 22;
        if (score > bestScore) {
            bestScore = score;
            best = { snake: other, x: goal.x, y: goal.y, distance: distance, score: score };
        }
    }
    return best;
};

BotSnake.prototype.findTargetFood = function(perception) {
    if (!perception || !perception.foodClusters.length) return null;
    var profile = this.getProfile();
    var current = this.headingVector(this.head.body.angle * Math.PI / 180);
    var best = null;
    var bestScore = -Infinity;
    for (var i = 0; i < perception.foodClusters.length; i++) {
        var cluster = perception.foodClusters[i];
        if (cluster.distance > 1120) continue;
        var direction = this.normalize(cluster.dx, cluster.dy);
        var alignment = this.dot(current.x, current.y, direction.x, direction.y);
        var obstacleDistance = perception.sectors[cluster.sector].obstacleDistance;
        var risk = obstacleDistance < 270 ? (270 - obstacleDistance) * 2.4 : 0;
        var turnCost = (1 - alignment) * 38;
        var distanceCost = cluster.distance * (this.profile === 'defender' ? 0.13 : 0.10);
        var score = cluster.value * 150 * profile.foodWeight - distanceCost - turnCost - risk;
        if (cluster.count > 2 && obstacleDistance > 430) score += 42;
        if (score > bestScore) {
            bestScore = score;
            best = cluster;
        }
    }
    return best;
};

BotSnake.prototype.decide = function(state, perception) {
    var threat = this.findThreat(perception);
    var profile = this.getProfile();
    this.threat = threat;
    this.attackPlan = null;
    this.target = null;
    this.targetPoint = null;

    if (threat) {
        this.behaviour = 'flee';
        this.targetPoint = {
            x: this.head.body.x - threat.dx * 2,
            y: this.head.body.y - threat.dy * 2
        };
        this.boostLockedUntil = ((this.game.time && this.game.time.now) || Date.now()) + 900;
        return;
    }

    var attackPlan = this.findAttackPlan(perception);
    if (attackPlan && profile.attackWeight > 0 && this.isGoalSafe(attackPlan.x, attackPlan.y, perception, 1.8)) {
        this.attackPlan = attackPlan;
        this.behaviour = 'attack';
        this.targetPoint = { x: attackPlan.x, y: attackPlan.y };
        return;
    }

    var food = this.findTargetFood(perception);
    if (food) {
        this.target = food.bestFood;
        this.behaviour = 'forage';
        this.targetPoint = { x: food.x, y: food.y };
        return;
    }

    this.behaviour = 'wander';
    this.wanderAngle += (Math.random() - 0.5) * 0.8;
    this.targetPoint = null;
};

BotSnake.prototype.isGoalSafe = function(x, y, perception, horizon) {
    if (!perception) return true;
    var direction = this.normalize(x - this.head.body.x, y - this.head.body.y);
    for (var i = 0; i < perception.hazards.length; i++) {
        if (this.timeToCollision(perception.hazards[i], direction, this.slowSpeed, horizon) < 1.5) return false;
    }
    return this.getWallClearance(direction, horizon) > 130;
};

BotSnake.prototype.getWallClearance = function(direction, horizon) {
    var state = this.game.state.getCurrentState();
    var mapScale = state && state.mapScale ? state.mapScale : 2.5;
    var width = this.game.width * mapScale;
    var height = this.game.height * mapScale;
    var speed = this.speed || this.slowSpeed;
    var futureX = this.head.body.x + direction.x * speed * horizon;
    var futureY = this.head.body.y + direction.y * speed * horizon;
    return Math.min(width - Math.abs(futureX), height - Math.abs(futureY));
};

BotSnake.prototype.chooseDirection = function(state, perception) {
    if (!perception) return this.headingVector(this.head.body.angle * Math.PI / 180);
    var currentAngle = this.head.body.angle * Math.PI / 180;
    var current = this.headingVector(currentAngle);
    var preferred = current;
    var preferredWeight = 0.35;

    if (this.behaviour === 'flee' && this.threat) {
        preferred = this.normalize(-this.threat.dx, -this.threat.dy);
        preferredWeight = 3.25;
        // Add a tangent component so fleeing from a body does not produce a
        // straight-line collision with the same body or a wall behind it.
        var tangent = { x: -preferred.y, y: preferred.x };
        var side = this.dot(current.x, current.y, tangent.x, tangent.y) >= 0 ? 1 : -1;
        preferred.x = preferred.x * 0.82 + tangent.x * side * 0.58;
        preferred.y = preferred.y * 0.82 + tangent.y * side * 0.58;
        preferred = this.normalize(preferred.x, preferred.y);
    } else if (this.targetPoint) {
        preferred = this.normalize(this.targetPoint.x - this.head.body.x, this.targetPoint.y - this.head.body.y);
        preferredWeight = this.behaviour === 'attack' ? 1.55 : 1.35;
    } else {
        preferred = this.headingVector(currentAngle + this.wanderAngle * 0.22);
    }

    var baseAngle = this.angleForVector(preferred.x, preferred.y);
    var offsets = [-1.18, -0.86, -0.58, -0.32, -0.14, 0, 0.14, 0.32, 0.58, 0.86, 1.18];
    var best = null;
    var bestScore = -Infinity;
    for (var i = 0; i < offsets.length; i++) {
        var candidate = this.headingVector(baseAngle + offsets[i]);
        var score = this.scoreDirection(candidate, preferred, current, preferredWeight, perception);
        if (score > bestScore) {
            bestScore = score;
            best = candidate;
        }
    }
    return best || preferred;
};

BotSnake.prototype.scoreDirection = function(candidate, preferred, current, preferredWeight, perception) {
    var profile = this.getProfile();
    var score = this.dot(candidate.x, candidate.y, preferred.x, preferred.y) * preferredWeight * 120;
    score += this.dot(candidate.x, candidate.y, current.x, current.y) * 18;
    score += this.getSectorDistance(perception, candidate) * 0.055;

    var horizon = this.behaviour === 'flee' ? 2.35 : 1.9;
    var speed = this.speed || this.slowSpeed;
    for (var i = 0; i < perception.hazards.length; i++) {
        var hazard = perception.hazards[i];
        var ttc = this.timeToCollision(hazard, candidate, speed, horizon);
        if (ttc === 0) return -100000;
        if (isFinite(ttc)) score -= (horizon - ttc + 0.2) * 540 * profile.dangerWeight;
        var projectedX = hazard.dx - candidate.x * speed * 0.72;
        var projectedY = hazard.dy - candidate.y * speed * 0.72;
        var projectedDistance = this.distance(projectedX, projectedY);
        var clearance = projectedDistance - hazard.radius;
        if (clearance < 90) score -= (90 - clearance) * 15 * profile.risk;
        else if (clearance < 260) score -= (260 - clearance) * 0.9 * profile.risk;
    }

    var wallClearance = this.getWallClearance(candidate, horizon);
    if (wallClearance < 0) return -100000;
    if (wallClearance < 190) score -= (190 - wallClearance) * 11 * profile.risk;
    else if (wallClearance < 430) score -= (430 - wallClearance) * 1.1 * profile.risk;

    if (this.behaviour === 'wander') {
        score += Math.sin(this.wanderAngle + this.angleForVector(candidate.x, candidate.y)) * 5;
    }
    return score;
};

BotSnake.prototype.updateBoost = function(state, perception) {
    var now = (this.game.time && this.game.time.now) || Date.now();
    var shouldBoost = false;
    if (this.snakeLength > this.minLength + 12 && now >= this.boostLockedUntil && this.behaviour !== 'flee') {
        var point = this.targetPoint;
        if (point) {
            var dx = point.x - this.head.body.x;
            var dy = point.y - this.head.body.y;
            var distance = this.distance(dx, dy);
            var direction = this.normalize(dx, dy);
            var safePath = this.getWallClearance(direction, 1.2) > 240;
            for (var i = 0; i < perception.hazards.length && safePath; i++) {
                if (this.timeToCollision(perception.hazards[i], direction, this.fastSpeed, 1.2) < 1.2) safePath = false;
            }
            if (safePath && distance > 260 && distance < 760) {
                if (this.behaviour === 'forage' && this.target && (this.target.nutrition || this.target.value || 1) >= 3) shouldBoost = true;
                if (this.behaviour === 'attack' && this.profile === 'hunter' && this.snakeLength > 48) shouldBoost = true;
            }
        }
    }
    if (shouldBoost !== this.boosting) this.setBoosting(shouldBoost);
};

BotSnake.prototype.turnToward = function(dx, dy) {
    if (!dx && !dy) return;
    var angle = this.angleForVector(dx, dy) * 180 / Math.PI;
    var difference = this.head.body.angle - angle;
    while (difference > 180) difference -= 360;
    while (difference < -180) difference += 360;
    this.head.body.setZeroRotation();
    var dt = Math.max(0.016, Number(this.game.time.physicsElapsed) || 0.016);
    var deadzone = 1.5 * this.getRotationSpeed() * dt;
    if (difference < -deadzone) {
        this.head.body.rotateRight(this.getRotationSpeed());
    } else if (difference > deadzone) {
        this.head.body.rotateLeft(this.getRotationSpeed());
    }
};
