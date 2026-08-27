/// <reference path="libs/Away3D.next.d.ts" />
/// <reference path="libs/tweenjs.d.ts" />
/// <reference path="TouchManager.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var demo;
(function (demo) {
    var TextureMaterial = away.materials.TextureMaterial;
    var PlaneGeometry = away.primitives.PlaneGeometry;
    var Mesh = away.entities.Mesh;
    var DirectionalLight = away.lights.DirectionalLight;
    var PointLight = away.lights.PointLight;
    var RequestAnimationFrame = away.utils.RequestAnimationFrame;
    var StaticLightPicker = away.materials.StaticLightPicker;
    var HoverController = away.controllers.HoverController;
    var ParticleAnimationSet = away.animators.ParticleAnimationSet;
    var ParticleAnimator = away.animators.ParticleAnimator;
    var ParticleBillboardNode = away.animators.ParticleBillboardNode;
    var ParticlePositionNode = away.animators.ParticlePositionNode;
    var ParticlePropertiesMode = away.animators.ParticlePropertiesMode;
    var ParticleVelocityNode = away.animators.ParticleVelocityNode;
    var ParticleColorNode = away.animators.ParticleColorNode;
    var ParticleFollowNode = away.animators.ParticleFollowNode;
    var ParticleScaleNode = away.animators.ParticleScaleNode;
    var ParticleGeometryHelper = away.tools.ParticleGeometryHelper;
    var Vector3D = away.geom.Vector3D;
    var ColorTransform = away.geom.ColorTransform;
    var ObjectContainer3D = away.containers.ObjectContainer3D;
    var BlendMode = away.display.BlendMode;
    var AssetLibrary = away.library.AssetLibrary;
    var LoaderEvent = away.events.LoaderEvent;
    var URLRequest = away.net.URLRequest;
    var FogMethod = away.materials.FogMethod;
    var TextureMultiPassMaterial = away.materials.TextureMultiPassMaterial;
    var ROUND = 100;
    var NUM_FIRES = 25;
    var GROUND_Y = -300;
    var LENS_FRARE_Z = 750;
    var RESOURCE_LIST = [
        "imgs/blue.png",
        "imgs/floor_diffuse.jpg",
        "imgs/floor_normal.jpg",
        "imgs/floor_specular.jpg",
        "imgs/lens_frare.png",
        "imgs/lens_frare_active.png",
    ];
    var Main = (function (_super) {
        __extends(Main, _super);
        function Main() {
            _super.call(this);
            this._loadedCount = 0;
            this.fireObjects = [];
            var touchManager = new utils.TouchManager();
            touchManager.enableTouch();
            touchManager.addListener(document.body);
            this.onResize();
            this.render();
            // Import Assets
            AssetLibrary.addEventListener(LoaderEvent.RESOURCE_COMPLETE, this.onResourceCompelte, this);
            for (var i = 0; i < RESOURCE_LIST.length; i++) {
                AssetLibrary.load(new URLRequest(RESOURCE_LIST[i]));
            }
        }
        Main.prototype.onResourceCompelte = function (event) {
            this._loadedCount++;
            if (this._loadedCount < RESOURCE_LIST.length)
                return;
            this.init();
        };
        Main.prototype.init = function () {
            this.camera.lens.fieldOfView = 70;
            this.camera.lens.far = 20000;
            //setup controller to be used on the camera
            this.cameraController = new HoverController(this.camera);
            this.cameraController.minTiltAngle = -6;
            this.cameraController.maxTiltAngle = 30;
            this.cameraController.panAngle = 45;
            this.cameraController.tiltAngle = 5;
            this.cameraController.steps = 20;
            this.reset();
            this.initLights();
            this.initMaterials();
            this.initParticles();
            this.initObjects();
            this.initListeners();
            createjs.Ticker.useRAF = true;
            createjs.Ticker.setFPS(60);
            this.stats = new Stats();
            document.body.appendChild(this.stats.domElement);
        };
        /**
         * Initialise the listeners
         */
        Main.prototype.initListeners = function () {
            var _this = this;
            // アニメーションさせるためにループイベントを指定します
            var raf = new RequestAnimationFrame(this.enterFrameHandler, this);
            raf.start();
            document.onmousedown = function (event) { return _this.onMouseDown(event); };
            document.onmouseup = function (event) { return _this.onMouseUp(event); };
            document.onmousemove = function (event) { return _this.onMouseMove(event); };
            window.onresize = function (event) { return _this.onResize(); };
        };
        /**
         * Initialise the lights
         */
        Main.prototype.initLights = function () {
            this.lightDirectional = new DirectionalLight(0, -1, 0.1);
            this.lightDirectional.castsShadows = false;
            this.lightDirectional.color = 0x993300;
            this.lightDirectional.diffuse = 1;
            this.lightDirectional.ambient = .0;
            this.lightDirectional.specular = 0.25;
            this.lightDirectional.ambientColor = 0x0;
            this.scene.addChild(this.lightDirectional);
            this.lightPicker = new StaticLightPicker([this.lightDirectional]);
        };
        /**
         * Initialise the materials
         */
        Main.prototype.initMaterials = function () {
            var fog = new FogMethod(1000, 4500, 0x0);
            this.planeMaterial = new TextureMultiPassMaterial(AssetLibrary.getAsset(RESOURCE_LIST[1]));
            this.planeMaterial.specularMap = AssetLibrary.getAsset(RESOURCE_LIST[3]);
            this.planeMaterial.normalMap = AssetLibrary.getAsset(RESOURCE_LIST[2]);
            this.planeMaterial.lightPicker = this.lightPicker;
            this.planeMaterial.repeat = true;
            this.planeMaterial.smooth = false;
            this.planeMaterial.mipmap = false;
            this.planeMaterial.specular = 15;
            this.planeMaterial.addMethod(fog);
            this.particleMaterial = new TextureMaterial(AssetLibrary.getAsset(RESOURCE_LIST[0]));
            this.particleMaterial.blendMode = BlendMode.ADD;
            this.particleMaterial.smooth = false;
            this.particleMaterial.mipmap = false;
            this.particleMaterial.alphaBlending = false;
            this.particleSpriteMaterial = new TextureMaterial(AssetLibrary.getAsset(RESOURCE_LIST[4]));
            this.particleSpriteMaterial.blendMode = BlendMode.ADD;
            this.particleActSpriteMaterial = new TextureMaterial(AssetLibrary.getAsset(RESOURCE_LIST[5]));
            this.particleActSpriteMaterial.blendMode = BlendMode.ADD;
        };
        /**
         * Initialise the particles
         */
        Main.prototype.initParticles = function () {
            var _this = this;
            //create the particle animation set
            this.fireAnimationSet = new ParticleAnimationSet(true, true);
            //add some animations which can control the particles:
            //the global animations can be set directly, because they influence all the particles with the same factor
            this.fireAnimationSet.addAnimation(new ParticleBillboardNode());
            this.fireAnimationSet.addAnimation(new ParticlePositionNode(ParticlePropertiesMode.LOCAL_STATIC));
            this.fireAnimationSet.addAnimation(this.particleScaleNode = new ParticleScaleNode(ParticlePropertiesMode.GLOBAL, false, false, 2, 0.5));
            this.fireAnimationSet.addAnimation(this.particleFollowNode = new ParticleFollowNode(true, false));
            // ParticleAccelerationNode はバグのため利用していない
            this.fireAnimationSet.addAnimation(new ParticleColorNode(ParticlePropertiesMode.GLOBAL, true, true, false, false, new ColorTransform(0, 0, 0, 1, 0xFF, 0x66, 0x22), new ColorTransform(0, 0, 0, 1, 0x99)));
            //no need to set the local animations here, because they influence all the particle with different factors.
            this.fireAnimationSet.addAnimation(new ParticleVelocityNode(ParticlePropertiesMode.LOCAL_STATIC));
            //set the initParticleFunc. It will be invoked for the local static property initialization of every particle
            this.fireAnimationSet.initParticleFunc = function (prop) { return _this.initParticleFunc(prop); };
            //create the original particle geometry
            var particle = new PlaneGeometry(50, 50, 1, 1, false);
            //combine them into a list
            var geometrySet = [];
            for (var i = 0; i < 50; i++)
                geometrySet.push(particle);
            this.particleGeometry = ParticleGeometryHelper.generateGeometry(geometrySet);
        };
        /**
         * Initialise the scene objects
         */
        Main.prototype.initObjects = function () {
            // create the terrain mesh
            var plane = new Mesh(new PlaneGeometry(6000, 6000), this.planeMaterial);
            plane.geometry.scaleUV(8, 8);
            plane.y = GROUND_Y;
            this.scene.addChild(plane);
            for (var i = 0; i < NUM_FIRES; i++) {
                var particleMesh = new Mesh(this.particleGeometry, this.particleMaterial);
                var animator = new ParticleAnimator(this.fireAnimationSet);
                particleMesh.animator = animator;
                animator.start();
                this.particleFollowNode.getAnimationState(animator).followTarget = this.collisions[i];
                //create a fire object and add it to the fire object vector
                var fireObject = new FireVO(particleMesh, animator);
                this.fireObjects.push(fireObject);
                this.scene.addChild(particleMesh);
                this.createFireLight(fireObject);
            }
            var particleMain = new Mesh(this.particleGeometry, this.particleMaterial);
            particleMain.y = GROUND_Y;
            var animatorMain = new ParticleAnimator(this.fireAnimationSet);
            this.particleScaleNode.getAnimationState(animatorMain).maxScale = 15;
            particleMain.animator = animatorMain;
            animatorMain.start();
            this.scene.addChild(particleMain);
            this.fireSprite = [];
            this.fireActSprite = [];
            for (var i = 0; i < NUM_FIRES; i++) {
                var obj = new away.entities.Sprite3D(this.particleSpriteMaterial, 512 * 2, 512 * 2);
                obj.position = this.resetPosition();
                this.scene.addChild(obj);
                this.fireSprite[i] = obj;
                var obj = new away.entities.Sprite3D(this.particleActSpriteMaterial, 512 * 3, 512 * 3);
                obj.position = this.resetPosition();
                this.scene.addChild(obj);
                this.fireActSprite[i] = obj;
            }
        };
        /**
         * Returns an array of active lights in the scene
         */
        Main.prototype.getAllLights = function () {
            var lights = [];
            lights.push(this.lightDirectional);
            for (var i = 0; i < this.fireObjects.length; i++) {
                var fireVO = this.fireObjects[i];
                if (fireVO.light)
                    lights.push(fireVO.light);
            }
            return lights;
        };
        /**
         * Timer event handler
         */
        Main.prototype.createFireLight = function (fireObject) {
            //start the animator
            //			fireObject.animator.start();
            //create the lightsource
            var light = new PointLight();
            light.color = 0xFF6622;
            light.diffuse = 0;
            light.specular = 0;
            light.position = fireObject.mesh.position;
            //add the lightsource to the fire object
            fireObject.light = light;
            //update the lightpicker
            this.lightPicker.lights = this.getAllLights();
        };
        /**
         * Initialiser function for particle properties
         */
        Main.prototype.initParticleFunc = function (prop) {
            prop.startTime = Math.random() * 2;
            prop.duration = Math.random() * 0.6 + 0.1;
            var r = 600;
            prop[ParticleVelocityNode.VELOCITY_VECTOR3D] = new Vector3D(r * (Math.random() - 0.5), r * (Math.random() - 0.5) + 1000, r * (Math.random() - 0.5));
            r = 10;
            prop[ParticlePositionNode.POSITION_VECTOR3D] = new Vector3D(r * (Math.random() - 0.5), r * (Math.random() - 0.5), r * (Math.random() - 0.5));
        };
        Main.prototype.enterFrameHandler = function (e) {
            this.stats.begin();
            //animate lights
            var fireVO;
            for (var i = 0; i < this.fireObjects.length; i++) {
                fireVO = this.fireObjects[i];
                //update flame light
                var light = fireVO.light;
                if (fireVO.strength < 1)
                    fireVO.strength += 0.1;
                if (light == null)
                    continue;
                light.fallOff = 1080 + Math.random() * 20;
                light.radius = 1;
                light.diffuse = light.specular = fireVO.strength + Math.random() * .2;
                light.position = this.collisions[i].position;
                // 火の粉
                this.fireSprite[i].position = this.collisions[i].position;
                this.fireActSprite[i].position = this.collisions[i].position;
                this.fireActSprite[i].visible = this.camera.project(this.fireActSprite[i].position).z < LENS_FRARE_Z && this.fireActSprite[i].y > 200; // 原点より手間に来たら
            }
            this.particleSpriteMaterial.alpha = Math.random() * 0.1 + 0.9;
            this.particleActSpriteMaterial.alpha = Math.random() * 0.2 + 0.8;
            this.render();
            this.stats.end();
        };
        Main.prototype.reset = function () {
            if (this.collisions == null) {
                this.collisions = [];
                for (var i = 0; i < NUM_FIRES; i++) {
                    // create cylinders
                    var skin = new ObjectContainer3D();
                    //skin.addChild(new away.primitives.WireframeSphere()); // For Debug
                    skin.position = this.resetPosition();
                    this.scene.addChild(skin);
                    this.collisions.push(skin);
                    var delay = 6000 * Math.random();
                    // 火の粉
                    new createjs.Timeline([
                        createjs.Tween.get(skin).wait(delay).to({
                            x: 5000 * (Math.random() - 0.5),
                            z: 5000 * (Math.random() - 0.5)
                        }, 6000, createjs.Ease.sineOut).set({ x: 0, y: GROUND_Y, z: 0 }),
                        createjs.Tween.get(skin).wait(delay).to({
                            y: 500 + 500 * Math.random()
                        }, 2000, createjs.Ease.cubicOut).to({
                            y: GROUND_Y
                        }, 4000, createjs.Ease.bounceOut)
                    ], null, { loop: true }).gotoAndPlay(0);
                }
            }
            for (i = 0; i < this.collisions.length; i++) {
                // create cylinders
                var body = this.collisions[i];
                body.position = this.resetPosition();
            }
        };
        Main.prototype.resetPosition = function () {
            return new Vector3D(ROUND * (Math.random() - 0.5), GROUND_Y, ROUND * (Math.random() - 0.5));
        };
        /** マウスを押したとき */
        Main.prototype.onMouseDown = function (event) {
            this.lastPanAngle = this.cameraController.panAngle;
            this.lastTiltAngle = this.cameraController.tiltAngle;
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
            this.isMouseDown = true;
        };
        /** マウスを離したとき */
        Main.prototype.onMouseUp = function (event) {
            this.isMouseDown = false;
        };
        /** マウスを動かした時 */
        Main.prototype.onMouseMove = function (event) {
            if (this.isMouseDown) {
                this.cameraController.panAngle = 0.4 * (event.clientX - this.lastMouseX) + this.lastPanAngle;
                this.cameraController.tiltAngle = 0.4 * (event.clientY - this.lastMouseY) + this.lastTiltAngle;
            }
        };
        Main.prototype.onResize = function () {
            this.width = window.innerWidth;
            this.height = window.innerHeight;
        };
        return Main;
    })(away.containers.View3D);
    demo.Main = Main;
    /**
     * Data class for the fire objects
     */
    var FireVO = (function () {
        function FireVO(mesh, animator) {
            this.strength = 0;
            this.mesh = mesh;
            this.animator = animator;
        }
        return FireVO;
    })();
})(demo || (demo = {}));
window.onload = function () {
    new demo.Main();
};
