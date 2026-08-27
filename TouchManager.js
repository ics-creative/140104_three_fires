var utils;
(function (utils) {
    /**
     * TouchManagerクラスはTouchEventを自動的にMouseEventに変換します。
     *
     * @since 2014/09/18
     * @class utils.TouchManager
     * @author Yasunobu Ikeda
     */
    var TouchManager = (function () {
        /**
         * @constructor
         */
        function TouchManager() {
            /**
             * タッチが有効なデバイスかどうかを示す真偽値です。
             *
             * @property isSupportedTouch
             * @type {Boolean}
             * @default false
             */
            this.isSupportedTouch = false;
            this.isSupportedTouch = ('ontouchstart' in window);
        }
        /**
         * デフォルトのタッチ操作を無効にします。
         *
         * @method enableTouch
         */
        TouchManager.prototype.enableTouch = function () {
            if (this.isSupportedTouch) {
                // スクロールの防止
                document.body.addEventListener('touchmove', function (event) {
                    event.preventDefault();
                }, false);
            }
        };
        /**
         * イベントを登録します。ここで登録されたエレメントにおいては、TouchEventが自動的にMouseEventに割り当てられます。
         *
         * @param  element    HTMLのエレメント
         * @method addListener
         */
        TouchManager.prototype.addListener = function (element) {
            var _this = this;
            element.addEventListener("touchstart", function (event) {
                _this.handleTouch(event);
            }, true);
            element.addEventListener("touchmove", function (event) {
                _this.handleTouch(event);
            }, true);
            element.addEventListener("touchend", function (event) {
                _this.handleTouch(event);
            }, true);
            element.addEventListener("touchcancel", function (event) {
                _this.handleTouch(event);
            }, true);
        };
        TouchManager.prototype.handleTouch = function (event) {
            var touches = event.changedTouches, touch = touches[0], type = "";
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
            simulatedEvent.initMouseEvent(type, true, true, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);
            touch.target.dispatchEvent(simulatedEvent);
            event.preventDefault();
        };
        return TouchManager;
    })();
    utils.TouchManager = TouchManager;
})(utils || (utils = {}));
