/// <reference path="libs/Away3D.next.d.ts" />
/// <reference path="libs/tweenjs.d.ts" />
/// <reference path="TouchManager.ts" />

declare var Stats; // Stats.jsのため

module demo {

	// Away3Dライブラリを読み込み
	import View3D                          = away.containers.View3D;
	import TextureMaterial                 = away.materials.TextureMaterial;
	import ColorMaterial                   = away.materials.ColorMaterial;
	import SphereGeometry                  = away.primitives.SphereGeometry;
	import PlaneGeometry                   = away.primitives.PlaneGeometry;
	import Geometry                        = away.base.Geometry;
	import Mesh                            = away.entities.Mesh;
	import DirectionalLight                = away.lights.DirectionalLight;
	import PointLight                      = away.lights.PointLight;
	import RequestAnimationFrame           = away.utils.RequestAnimationFrame;
	import StaticLightPicker               = away.materials.StaticLightPicker;
	import HTMLImageElementTexture         = away.textures.HTMLImageElementTexture;
	import HoverController                 = away.controllers.HoverController;
	import Sprite3D                        = away.entities.Sprite3D;
	import ParticleAnimationSet            = away.animators.ParticleAnimationSet;
	import ParticleAnimator                = away.animators.ParticleAnimator;
	import ParticleBillboardNode           = away.animators.ParticleBillboardNode;
	import ParticleInitialColorNode        = away.animators.ParticleInitialColorNode;
	import ParticlePositionNode            = away.animators.ParticlePositionNode;
	import ParticleProperties              = away.animators.ParticleProperties;
	import ParticlePropertiesMode          = away.animators.ParticlePropertiesMode;
	import ParticleVelocityNode            = away.animators.ParticleVelocityNode;
	import ParticleColorNode               = away.animators.ParticleColorNode;
	import ParticleFollowNode              = away.animators.ParticleFollowNode;
	import ParticleScaleNode               = away.animators.ParticleScaleNode;
	import ParticleGeometry                = away.base.ParticleGeometry;
	import ParticleGeometryHelper          = away.tools.ParticleGeometryHelper;
	import ParticleGeometryTransform       = away.tools.ParticleGeometryTransform;
	import Vector3D                        = away.geom.Vector3D;
	import ColorTransform                  = away.geom.ColorTransform;
	import Object3D                        = away.base.Object3D;
	import PerspectiveLens                 = away.cameras.PerspectiveLens;
	import ObjectContainer3D               = away.containers.ObjectContainer3D;
	import BlendMode                       = away.display.BlendMode;
	import Cast                            = away.utils.Cast;
	import WireframePlane                  = away.primitives.WireframePlane;
	import AssetLibrary                    = away.library.AssetLibrary;
	import Texture2DBase                   = away.textures.Texture2DBase;
	import LoaderEvent                     = away.events.LoaderEvent;
	import URLRequest                      = away.net.URLRequest;
	import FogMethod                       = away.materials.FogMethod;
	import TextureMultiPassMaterial        = away.materials.TextureMultiPassMaterial;


	var ROUND:number = 100;
	var NUM_FIRES:number = 25;
	var GROUND_Y:number = -300;
	var LENS_FRARE_Z:number = 750;
	var RESOURCE_LIST:string[] = [
		"imgs/blue.png",
		"imgs/floor_diffuse.jpg",
		"imgs/floor_normal.jpg",
		"imgs/floor_specular.jpg",
		"imgs/lens_frare.png",
		"imgs/lens_frare_active.png",
	];

	export class Main extends away.containers.View3D {

		private _loadedCount = 0;

		private cameraController:HoverController;
		private fireAnimationSet:ParticleAnimationSet
		private fireObjects:FireVO[] = [];
		private collisions:ObjectContainer3D[];
		private lastMouseX:number;
		private lastMouseY:number;
		private lastPanAngle:number;
		private lastTiltAngle:number;
		private isMouseDown:boolean;
		private lightDirectional:DirectionalLight;
		private lightPicker:StaticLightPicker;
		private particleFollowNode:ParticleFollowNode;
		private particleGeometry:ParticleGeometry;
		private particleMaterial:TextureMaterial;
		private particleScaleNode:ParticleScaleNode;
		private planeMaterial:TextureMultiPassMaterial;
		private particleSpriteMaterial:TextureMaterial;
		private particleActSpriteMaterial:TextureMaterial;
		private stats:any;

		constructor() {
			super();

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

		onResourceCompelte(event:LoaderEvent) {
			this._loadedCount++;
			if (this._loadedCount < RESOURCE_LIST.length)
				return;

			this.init();
		}

		init() {
			(<PerspectiveLens> this.camera.lens).fieldOfView = 70;
			(<PerspectiveLens> this.camera.lens).far = 20000;

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
		}

		/**
		 * Initialise the listeners
		 */
		private initListeners() {
			// アニメーションさせるためにループイベントを指定します
			var raf = new RequestAnimationFrame(this.enterFrameHandler, this);
			raf.start();

			document.onmousedown = (event) => this.onMouseDown(event);
			document.onmouseup = (event) => this.onMouseUp(event);
			document.onmousemove = (event) => this.onMouseMove(event);
			window.onresize = (event) => this.onResize();
		}

		/**
		 * Initialise the lights
		 */
		private initLights() {
			this.lightDirectional = new DirectionalLight(0, -1, 0.1);
			this.lightDirectional.castsShadows = false;
			this.lightDirectional.color = 0x993300;
			this.lightDirectional.diffuse = 1;
			this.lightDirectional.ambient = .0;
			this.lightDirectional.specular = 0.25;
			this.lightDirectional.ambientColor = 0x0;
			this.scene.addChild(this.lightDirectional);

			this.lightPicker = new StaticLightPicker([this.lightDirectional]);
		}

		/**
		 * Initialise the materials
		 */
		private initMaterials() {
			var fog:FogMethod = new FogMethod(1000, 4500, 0x0);

			this.planeMaterial = new TextureMultiPassMaterial(<Texture2DBase> AssetLibrary.getAsset(RESOURCE_LIST[1]));
			this.planeMaterial.specularMap = <Texture2DBase> AssetLibrary.getAsset(RESOURCE_LIST[3]);
			this.planeMaterial.normalMap = <Texture2DBase> AssetLibrary.getAsset(RESOURCE_LIST[2]);
			this.planeMaterial.lightPicker = this.lightPicker;
			this.planeMaterial.repeat = true;
			this.planeMaterial.smooth = false;
			this.planeMaterial.mipmap = false;
			this.planeMaterial.specular = 15;
			this.planeMaterial.addMethod(fog);

			this.particleMaterial = new TextureMaterial(<Texture2DBase> AssetLibrary.getAsset(RESOURCE_LIST[0]));
			this.particleMaterial.blendMode = BlendMode.ADD;
			this.particleMaterial.smooth = false;
			this.particleMaterial.mipmap = false;
			this.particleMaterial.alphaBlending = false;

			this.particleSpriteMaterial = new TextureMaterial(<Texture2DBase> AssetLibrary.getAsset(RESOURCE_LIST[4]));
			this.particleSpriteMaterial.blendMode = BlendMode.ADD;

			this.particleActSpriteMaterial = new TextureMaterial(<Texture2DBase> AssetLibrary.getAsset(RESOURCE_LIST[5]));
			this.particleActSpriteMaterial.blendMode = BlendMode.ADD;

		}

		private fireSprite:Sprite3D[];
		private fireActSprite:Sprite3D[];

		/**
		 * Initialise the particles
		 */
		private initParticles() {
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
			this.fireAnimationSet.initParticleFunc = (prop) => this.initParticleFunc(prop);

			//create the original particle geometry
			var particle:Geometry = new PlaneGeometry(50, 50, 1, 1, false);

			//combine them into a list
			var geometrySet:Geometry[] = [];
			for (var i:number = 0; i < 50; i++)
				geometrySet.push(particle);

			this.particleGeometry = ParticleGeometryHelper.generateGeometry(geometrySet);
		}

		/**
		 * Initialise the scene objects
		 */
		private initObjects() {
			// create the terrain mesh
			var plane:Mesh = new Mesh(new PlaneGeometry(6000, 6000), this.planeMaterial);
			plane.geometry.scaleUV(8, 8);
			plane.y = GROUND_Y;
			this.scene.addChild(plane);

			// reate fire object meshes from geomtry and material, and apply particle animators to each
			for (var i:number = 0; i < NUM_FIRES; i++) {
				var particleMesh:Mesh = new Mesh(this.particleGeometry, this.particleMaterial);
				var animator:ParticleAnimator = new ParticleAnimator(this.fireAnimationSet);
				particleMesh.animator = animator;
				animator.start();
				this.particleFollowNode.getAnimationState(animator).followTarget = this.collisions[i];

				//create a fire object and add it to the fire object vector
				var fireObject:FireVO = new FireVO(particleMesh, animator);
				this.fireObjects.push(fireObject);
				this.scene.addChild(particleMesh);
				this.createFireLight(fireObject);
			}

			var particleMain:Mesh = new Mesh(this.particleGeometry, this.particleMaterial);
			particleMain.y = GROUND_Y;
			var animatorMain:ParticleAnimator = new ParticleAnimator(this.fireAnimationSet);
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
		}

		/**
		 * Returns an array of active lights in the scene
		 */
		private getAllLights() {
			var lights = [];

			lights.push(this.lightDirectional);

			for (var i = 0; i < this.fireObjects.length; i++) {
				var fireVO:FireVO = this.fireObjects[i];
				if (fireVO.light)
					lights.push(fireVO.light);
			}

			return lights;
		}

		/**
		 * Timer event handler
		 */
		private createFireLight(fireObject:FireVO) {
			//start the animator
//			fireObject.animator.start();

			//create the lightsource
			var light:PointLight = new PointLight();
			light.color = 0xFF6622;
			light.diffuse = 0;
			light.specular = 0;
			light.position = fireObject.mesh.position;

			//add the lightsource to the fire object
			fireObject.light = light;

			//update the lightpicker
			this.lightPicker.lights = this.getAllLights();
		}

		/**
		 * Initialiser function for particle properties
		 */
		private initParticleFunc(prop:ParticleProperties) {
			prop.startTime = Math.random() * 2;
			prop.duration = Math.random() * 0.6 + 0.1;

			var r:number = 600;
			prop[ParticleVelocityNode.VELOCITY_VECTOR3D] = new Vector3D(
				r * (Math.random() - 0.5),
				r * (Math.random() - 0.5) + 1000,
				r * (Math.random() - 0.5));

			r = 10;
			prop[ParticlePositionNode.POSITION_VECTOR3D] = new Vector3D(
				r * (Math.random() - 0.5),
				r * (Math.random() - 0.5),
				r * (Math.random() - 0.5));
		}

		private enterFrameHandler(e:Event) {

			this.stats.begin();

			//animate lights
			var fireVO:FireVO;
			for (var i:number = 0; i < this.fireObjects.length; i++) {
				fireVO = this.fireObjects[i];
				//update flame light
				var light:PointLight = fireVO.light;

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
		}

		private reset() {
			if (this.collisions == null) {
				this.collisions = [];

				for (var i = 0; i < NUM_FIRES; i++) {
					// create cylinders
					var skin:ObjectContainer3D = new ObjectContainer3D();
					//skin.addChild(new away.primitives.WireframeSphere()); // For Debug
					skin.position = this.resetPosition();
					this.scene.addChild(skin);
					this.collisions.push(skin);

					var delay:number = 6000 * Math.random();

					// 火の粉
					new createjs.Timeline([

						// 拡散
						createjs.Tween.get(skin)
							.wait(delay)
							.to({
								x: 5000 * (Math.random() - 0.5),
								z: 5000 * (Math.random() - 0.5)
							}, 6000, createjs.Ease.sineOut)
							.set({x: 0, y: GROUND_Y, z: 0}),

						// 高さ
						createjs.Tween.get(skin)
							.wait(delay)
							.to({
								y: 500 + 500 * Math.random()
							}, 2000, createjs.Ease.cubicOut)
							.to({
								y: GROUND_Y
							}, 4000, createjs.Ease.bounceOut)
					], null, {loop: true}).gotoAndPlay(0);
				}
			}

			for (i = 0; i < this.collisions.length; i++) {
				// create cylinders
				var body = this.collisions[i];
				body.position = this.resetPosition();
			}
		}


		private resetPosition():Vector3D {
			return new Vector3D(ROUND * (Math.random() - 0.5), GROUND_Y, ROUND * (Math.random() - 0.5))
		}

		/** マウスを押したとき */
		private onMouseDown(event) {
			this.lastPanAngle = this.cameraController.panAngle;
			this.lastTiltAngle = this.cameraController.tiltAngle;
			this.lastMouseX = event.clientX;
			this.lastMouseY = event.clientY;
			this.isMouseDown = true;
		}

		/** マウスを離したとき */
		private onMouseUp(event) {
			this.isMouseDown = false;
		}

		/** マウスを動かした時 */
		private onMouseMove(event) {
			if (this.isMouseDown) {
				this.cameraController.panAngle = 0.4 * (event.clientX - this.lastMouseX) + this.lastPanAngle;
				this.cameraController.tiltAngle = 0.4 * (event.clientY - this.lastMouseY) + this.lastTiltAngle;
			}
		}

		private onResize() {
			this.width = window.innerWidth;
			this.height = window.innerHeight;
		}

	}

	/**
	 * Data class for the fire objects
	 */
	class FireVO {
		constructor(mesh:Mesh, animator:ParticleAnimator) {
			this.mesh = mesh;
			this.animator = animator;
		}

		animator:ParticleAnimator;
		light:PointLight;
		mesh:Mesh;
		strength:number = 0;
	}

}

window.onload = ()=> {
	new demo.Main();
}