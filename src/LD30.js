var screenHeight = 560;
var screenWidth = 960;
var goodEnd = true;

var LD30 = function() {

    /**
     * Start stuff when the page loads.
     */
    this.onload = function() {
        if ( !me.video.init( 'canvas', screenWidth, screenHeight ) ) {
            alert ("Yer browser be not workin");
        }

        me.audio.init ("m4a,ogg" );

        // Sync up post loading stuff.
        me.loader.onload = this.loaded.bind( this );

        me.loader.preload( GameResources );

        me.state.change( me.state.LOADING );


        return;
    };

    /**
     * Do stuff post-resource-load.
     */
    this.loaded = function() {

        me.state.set( me.state.INTRO, new RadmarsScreen() );
        me.state.set( me.state.MENU, new TitleScreen() );
        me.state.set( me.state.PLAY, new PlayScreen() );
        me.state.set( me.state.GAMEOVER, new GameOverScreen() );

        me.state.change( me.state.INTRO);

        me.pool.register( "player", Player );
        me.pool.register( "baddie", Baddie );

        me.pool.register( "fish", Fish );
        me.pool.register( "wasp", Wasp );

        me.pool.register( "pickup", Pickup );
        me.pool.register( "underworld", Underworld );
        me.pool.register( "levelchanger", LevelChanger );
        me.pool.register( "gameender", GameEnder );
    };
};


LD30.data = {souls:1, collectedSouls:0, collectedSoulsMax:15, beatGame:false};

LD30.HUD = LD30.HUD || {};

LD30.HUD.Container = me.ObjectContainer.extend({
    init: function() {
        // call the constructor
        this.parent();

        this.isPersistent = true;
        this.collidable = false;

        // make sure our object is always draw first
        this.z = Infinity;
        this.name = "HUD";
        this.soulDisplay = new LD30.HUD.SoulDisplay(25, 25);
        this.addChild(this.soulDisplay);
    },

    startGame:function(){
        this.soulDisplay.startGame();
    },

    endGame: function(){
        this.soulDisplay.endGame();
    },

    toUnderworld: function() {
        this.soulDisplay.toUnderworld();
    }
});

LD30.HUD.SoulDisplay = me.Renderable.extend( {
    /**
     * constructor
     */
    init: function(x, y) {

        // call the parent constructor
        // (size does not matter here)
        this.parent(new me.Vector2d(x, y), 10, 10);

        // create a font
        this.font = new me.BitmapFont("32x32_font", 32);
        //this.font.set("right");

        this.render = false;

        // make sure we use screen coordinates
        this.floating = true;
    },

    startGame: function(){
        this.render = true;
        var self = this;
        /*
        new me.Tween(self.findGatePos).to({x:100}, 500).easing(me.Tween.Easing.Quintic.Out).delay(1000).onComplete(function(){
            new me.Tween(self.findGatePos).to({x:1000}, 1000).easing(me.Tween.Easing.Quintic.In).delay(2000).onComplete(function(){
                self.showFindGate = false;
            }).start();
        }).start();
        */
    },

    endGame: function(){
        this.render = false;
    },

    update : function () {
        this.souls =  LD30.data.souls;
        return true;
    },

    draw : function (context) {
        if(!this.render)return;
    }

});


var LevelChanger = me.ObjectEntity.extend({
    init: function(x, y, settings) {
        // TODO: Just bake image or attach to obj?
        settings.image = "gateway";
        settings.spritewidth = 144;
        settings.spriteheight = 192;
        this.toLevel = settings.toLevel;
        this.parent( x, y, settings );
        this.gravity = 0;
        this.collidable = true;
        this.flipX(true);
    },
    update: function(dt) {
        // TODO: Just bake image or attach to obj?
        this.parent(dt);
        this.updateMovement();

        me.game.world.collide(this, true).forEach(function(col) {
            if(col && col.obj == me.state.current().player  ) {
                me.state.current().goToLevel(this.toLevel);
            }
        }, this);
    }
});

var GameEnder = me.ObjectEntity.extend({
    init: function(x, y, settings) {
        // TODO: Just bake image or attach to obj?
        settings.image = settings.image || 'pickup';
        settings.spritewidth =  69;
        settings.spriteheight = 117;
        this.toLevel = settings.toLevel;
        this.parent( x, y, settings );
        this.gravity = 0;
        this.collidable = true;
        this.flipX(true);
    },
    update: function(dt) {
        // TODO: Just bake image or attach to obj?
        this.parent(dt);
        this.updateMovement();

        me.game.world.collide(this, true).forEach(function(col) {
            if(col && col.obj == me.state.current().player  ) {
                LD30.data.collectedSouls += LD30.data.souls;
                LD30.data.souls = 0;
                me.state.current().endGame();
            }
        }, this);
    }
});


var Underworld = me.ObjectEntity.extend({
    init: function(x, y, settings) {
        settings.image = "gateway";
        settings.spritewidth = 144; //3
        settings.spriteheight = 192; //4
        this.parent( x, y, settings );
        this.gravity = 0;
        this.collidable = true;
    },
    update: function(dt) {
        this.parent(dt);
        this.updateMovement();
        me.game.world.collide(this, true).forEach(function(col) {
            if(col && col.obj == me.state.current().player ) {
                me.state.current().toUnderworld();
                me.state.current().player.toUnderworld();
            }
        }, true);
    }
});



/** The game play state... */
var PlayScreen = me.ScreenObject.extend({
    init: function() {
        this.parent( true );
        me.input.bindKey(me.input.KEY.SPACE, "shoot");
        this.baddies = [];
        this.pickups = [];
        this.overworld = true;
        this.subscription = me.event.subscribe(me.event.KEYDOWN, this.keyDown.bind(this));

        this.HUD = new LD30.HUD.Container();
        me.game.world.addChild(this.HUD);
        LD30.data.beatGame = false;

    },

    toUnderworld: function() {
        if( this.overworld ) {
            me.audio.mute( "ld30-real" );
			me.audio.unmute( "ld30-spirit" );

            me.audio.play( "portal" );
            me.audio.play( "lostsouls" );

            this.overworld = false;
            this.updateLayerVisibility(this.overworld);
            this.HUD.toUnderworld();
            me.game.viewport.shake(5, 1000);
        }
    },

    endGame: function(){
        LD30.data.beatGame = true;
        me.state.change( me.state.GAMEOVER );
    },

    goToLevel: function( level ) {
        if( !this.overworld ) {
            this.baddies = [];
            this.pickups = [];
            this.overworld = true;
            me.levelDirector.loadLevel( level );
            me.state.current().changeLevel( level );
            this.HUD.startGame();
        }
    },

    updateLayerVisibility: function(overworld) {
        var level = me.game.currentLevel;
        level.getLayers().forEach(function(layer){
            if( layer.name.match( /overworld/ ) ) {
                layer.alpha = overworld ? 1 : 0;
            }
            else if( layer.name.match( /underworld/ ) ) {
                layer.alpha = overworld ? 0 : 1;
            }
        }, this);

        this.baddies.forEach(function(baddie) {
            var m = baddie.overworld && overworld || (!baddie.overworld && !overworld);
            if(m) {
                baddie.renderable.alpha = .5;
               // baddie.collidable = false;
            }
            else {
                baddie.renderable.alpha = 1;
                //baddie.collidable = true;
            }
        });

        this.pickups.forEach(function(pickup) {
            var m = pickup.overworld && overworld || (!pickup.overworld && !overworld);
            if(m) {
                pickup.renderable.alpha = .5;
                //pickup.collidable = false;
            }
            else {
                pickup.renderable.alpha = 1;
                //pickup.collidable = true;
            }
        });

        me.game.repaint();
    },

    keyDown: function( action ) {
        if(action == "shoot") {
            this.player.shoot();
        }
    },

    getLevel: function() {
        return this.parseLevel( me.levelDirector.getCurrentLevelId() );
    },

    parseLevel: function( input ) {
        var re = /level(\d+)/;
        var results = re.exec( input );
        return results[1];
    },

    /** Update the level display & music. Called on all level changes. */
    changeLevel: function( level ) {
        me.audio.mute( "ld30-spirit" );
        me.audio.unmute( "ld30-real" );

        // TODO: Makethis track the real variable...
        this.updateLayerVisibility(this.overworld);
        // this only gets called on start?
        me.game.world.sort();

        me.game.viewport.fadeOut( '#000000', 1000, function() {
        });
    },

    // this will be called on state change -> this
    onResetEvent: function() {
        this.baddies = [];
        this.pickups = [];
        this.overworld = true;
        LD30.data.beatGame = false;
        LD30.data.collectedSouls = 0;
        LD30.data.souls = 1;
        var level =  location.hash.substr(1) || "level1" ;
        me.levelDirector.loadLevel( level );

        me.audio.stopTrack();
        me.audio.play( "ld30-real", true );
        me.audio.play( "ld30-spirit", true );
        me.audio.play( "portalrev" );

        this.changeLevel( level );
        this.HUD.startGame();
    },

    onDestroyEvent: function() {
        this.HUD.endGame();
		me.audio.stop("ld30-real");
		me.audio.stop("ld30-spirit");
    },

    update: function() {
        me.game.frameCounter++;
    }
});


window.onReady(function() {
    window.app = new LD30();
    window.app.onload();
});
