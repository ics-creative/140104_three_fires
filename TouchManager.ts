module utils {
	/**
	 * TouchManagerクラスはTouchEventを自動的にMouseEventに変換します。
	 *
	 * @since 2014/09/18
	 * @class utils.TouchManager
	 * @author Yasunobu Ikeda
	 */
	export class TouchManager {

		/**
		 * タッチが有効なデバイスかどうかを示す真偽値です。
		 *
		 * @property isSupportedTouch
		 * @type {Boolean}
		 * @default false
		 */
		public isSupportedTouch:boolean = false;

		/**
		 * @constructor
		 */
		constructor() {
			this.isSupportedTouch = ('ontouchstart' in window);
		}

		/**
		 * デフォルトのタッチ操作を無効にします。
		 *
		 * @method enableTouch
		 */
		public enableTouch() {
			if (this.isSupportedTouch) {
				// スクロールの防止
				document.body.addEventListener('touchmove', function (event) {
					event.preventDefault();
				}, false);
			}
		}

		/**
		 * イベントを登録します。ここで登録されたエレメントにおいては、TouchEventが自動的にMouseEventに割り当てられます。
		 *
		 * @param  element    HTMLのエレメント
		 * @method addListener
		 */
		public addListener(element:Node):void {
			element.addEventListener("touchstart", (event)=> {
				this.handleTouch(event);
			}, true);
			element.addEventListener("touchmove", (event)=> {
				this.handleTouch(event);
			}, true);
			element.addEventListener("touchend", (event)=> {
				this.handleTouch(event);
			}, true);
			element.addEventListener("touchcancel", (event)=> {
				this.handleTouch(event);
			}, true);
		}

		private handleTouch(event):void {
			var touches = event.changedTouches,
				touch = touches[0],
				type = "";

			// イベントのマッピング
			switch (event.type) {
				case "touchstart":
					type = "mousedown";
					break;
				case "touchmove":
					type = "mousemove";
					break;
				case "touchend":
					type = "mouseup";
					break;
				default:
					return;
			}

			/*
			 initMouseEvent(type, canBubble, cancelable, view, clickCount,
			 screenX, screenY, clientX, clientY, ctrlKey,
			 altKey, shiftKey, metaKey, button, relatedTarget);
			 */
			// ダミーのイベントを生成
			var simulatedEvent = document.createEvent("MouseEvent");

			// イベントの引数を適用
			simulatedEvent.initMouseEvent(type, true, true, window, 1,
				touch.screenX, touch.screenY,
				touch.clientX, touch.clientY, false,
				false, false, false, 0/*left*/, null);

			touch.target.dispatchEvent(simulatedEvent);
			event.preventDefault();
		}

	}
}