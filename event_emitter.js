(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(["require", 'lodash'], function (require, _) {
            var module = factory(_);

            if (require.specified('khoaijs')) {
                require(['khoaijs'], function (Khoai) {
                    Khoai.EventEmitter = module;
                });
            }

            root.EventEmitter = module;

            return module;
        });
    } else {
        var module = factory(root._);

        if (root.Khoai) {
            root.Khoai.EventEmitter = module;
        }

        root.EventEmitter = module;
    }
}(this, function (_) {
    "use strict";

    var unique_ids = {};

    function uniqueID(prefix) {
        if (!unique_ids.hasOwnProperty(prefix)) {
            unique_ids[prefix] = 0;
        }

        return prefix + ++unique_ids[prefix];
    }


    function EventEmitter() {
        this.type_prefix = this.type_prefix ? this.type_prefix : 'event_emitter';
        this.id = this.id ? this.id : uniqueID(this.type_prefix + '_');

        /**
         * Events, object with key is event name, object is an object with:
         * - key: index of listener, _{number}
         * - value: object, listener detail
         *  + priority: number, default is 500
         *  + times: number or true, limit of emit times
         *  + context: object|null, listener context, use event emitter instance if this value is not special
         *  + key: string, use to index listener (if need)
         *  + async: call listener in asynchronous mode
         *  + delay: async delay milliseconds, default is 1
         *  + listener_key: added listener key
         *
         * @property
         * @type {{}}
         * @private
         */
        this._events = {};

        /**
         * Listeners
         * - key: listener key,
         * - value:
         *  + listener: listener callback
         *  + events: object with key is event name, value is object with:
         *     + key: event index, _{number}
         *     + value: true
         *
         * @property
         * @type {{}}
         */
        this._listeners = {};

        /**
         * Listening instances
         * - key: instance id
         * - value: listen detail
         *  + target: listening object
         *  + name: instance name
         *  + listener_key: listener key of added event (on target instance), ready to remove listening
         *  + only: true|{}, only accept events, if is true then accept all of events, if is object -> keys are events name
         *  + except: {}, keys are except events
         *  + async: boolean, listen in asynchronous mode, default is true
         *  + add_method: string|function, method name to call when establish connect to listen instance, default is addListener. If this value is a function, then callback will receive parameters:
         *      + event emitter instance
         *      + target event emitter
         *      + listen detail
         *      + listen callback: function, parameters are:
         *          + event emitted,
         *          + emitted data...
         *
         *      + add listen options
         *
         *      Result of this function will use as listener key
         *
         *  + remove_method: string, method name to call when remove added listen to other instance, default is removeListener. If this value is a function, then callback will receive parameters:
         *      + listener key
         *
         *  + event: string, event to add to, default is 'notify'
         *  + mimics: true|array, list of events that will emit as event of this event emitter. True will mimic all of events. Default is empty array
         *
         * @property
         * @type {{}}
         */
        this._listening = {};

        /**
         * Object of mimic events
         * - key: event name
         * - value: true
         *
         * @property
         * @type {boolean|{}}
         */
        this._mimics = {};

        /**
         * @property
         * @type {{}|boolean}
         */
        this._private_events = {};

        /**
         * Default "this" argument for event listeners
         * @type {EventEmitter|*}
         */
        this.bound = this;
    }

    /**
     * Reset events
     * @param {Array|string} [events]
     * @return {EventEmitter}
     */
    EventEmitter.prototype.resetEvents = function (events) {
        if (!arguments.length) {
            events = _.keys(this._events);
        } else {
            events = _.flatten(_.toArray(arguments));
        }

        var self = this,
            removed = {};

        _.each(events, function (event) {
            if (self._events.hasOwnProperty(event)) {
                _.each(self._events[event], function (event_detail, index_key) {
                    if (unlinkListenerEvent(self, event_detail.listener_key, event, index_key)) {
                        _.set(removed, [event_detail.listener_key, event, index_key].join('.'), true);
                    }
                });

                delete self._events[event];
            }
        });

        _.each(removed, function (removed_events, listener_key) {
            _.each(removed_events, function (index_keys, removed_event) {
                self._listeners[listener_key].events[removed_event] = _.omit(self._listeners[listener_key].events[removed_event], _.keys(index_keys));

                if (_.isEmpty(self._listeners[listener_key].events[removed_event])) {
                    delete self._listeners[listener_key].events[removed_event];
                }
            });
        });

        return this;
    };

    /**
     * Reset events
     * @param {Array|string} [events]
     * @return {EventEmitter}
     */
    EventEmitter.prototype.reset = EventEmitter.prototype.resetEvents;

    /**
     *
     * @param {EventEmitter} instance
     * @param {string} listener_key
     * @param {string} event
     * @param {string} index_key
     */
    function unlinkListenerEvent(instance, listener_key, event, index_key) {
        if (!instance._listeners.hasOwnProperty(listener_key)) {
            return false;
        }
        if (!instance._listeners[listener_key].events.hasOwnProperty(event)) {
            return false;
        }

        delete instance._listeners[listener_key].events[event][index_key];

        return true;
    }

    /**
     *
     * @param {string|Array} events
     * @param {string|function} listener Listener callback or added listener key
     * @param {number|{}} [options] Options or priority
     * - priority: 500,
     * - times: true, call times, true is unlimited
     * - context: null, Context of callback. If not special will use event instance itself
     * - async: false, emit listener as asynchronous
     *
     * @return {string} Listener key
     * @throws
     * - Listener is not added: When use listener as added listener key and it is not added yet
     */
    EventEmitter.prototype.addListener = function (events, listener, options) {
        var self = this,
            key;

        events = _.uniq(_.castArray(events));
        options = getListenerOptions(this, options);

        if (_.isString(listener)) {
            if (!this._listeners.hasOwnProperty(listener)) {
                throw new Error('Listener is not added');
            }
            key = listener;
        } else {
            if (!options.key) {
                key = uniqueID(this.id + '_listener_');
            } else {
                key = options.key;
            }

            this._listeners[key] = {
                listener: listener,
                events: {}
            };
        }

        _.each(events, function (event) {
            if (!self._events.hasOwnProperty(event)) {
                self._events[event] = {};
            }

            var target_events = self._events[event],
                index_key = '_' + _.size(target_events);

            target_events[index_key] = _.extend({}, options, {listener_key: key});

            if (!self._listeners[key].events.hasOwnProperty(event)) {
                self._listeners[key].events[event] = {};
            }

            self._listeners[key].events[event][index_key] = true;
        });

        return key;
    };

    EventEmitter.prototype.on = EventEmitter.prototype.addListener;

    /**
     *
     * @param {EventEmitter} instance
     * @param {{}} options
     * @return {*}
     */
    function getListenerOptions(instance, options) {
        if (_.isNumber(options)) {
            options = {
                priority: options
            }
        }

        options = _.defaults(options || {}, {
            priority: 500,
            times: true,
            context: null,
            key: '',
            async: false,
            delay: 1
        });

        return options;
    }

    /**
     * Check if a listener key is exists
     * @param {string} listener_key
     * @param {boolean} [listening=true] Listener key must is using in any events
     * @return {boolean}
     */
    EventEmitter.prototype.has = function (listener_key, listening) {
        listening = listening || _.isUndefined(listening);

        return this._listeners.hasOwnProperty(listener_key) && (!listening || !_.isEmpty(this._listeners[listener_key].events));
    };

    /**
     * Remove listener
     * @param {string|function} listener Listener itself or listener key
     * @param {string|Array} [events] Remove on special events, default is all of events
     */
    EventEmitter.prototype.removeListener = function (listener, events) {
        var self = this,
            listener_keys = !_.isString(listener) ? getAllListenerKeys(this, listener) : [listener],
            listener_key,
            listener_events,
            target_events;

        if (!listener_keys.length) {
            return;
        }

        while (listener_key = listener_keys.shift()) {
            if (!this._listeners.hasOwnProperty(listener_key)) {
                continue;
            }

            listener_events = _.keys(this._listeners[listener_key].events);
            target_events = _.isUndefined(events) ? listener_events : _.intersection(_.castArray(events), listener_events);

            _.each(target_events, function (event) {
                if (self._events.hasOwnProperty(event)) {
                    self._events[event] = _.omit(self._events[event], _.keys(self._listeners[listener_key].events[event]));
                    delete self._listeners[listener_key].events[event];
                }
            });
        }
    };
    EventEmitter.prototype.removeListeners = function (listeners, events) {
        var self = this;

        _.each(listeners, function (listener) {
            self.removeListener(listener, events);
        });
    };

    function getAllListenerKeys(instance, listener) {
        var result = [];

        _.each(instance._listeners, function (detail, listener_key) {
            if (detail.listener === listener) {
                result.push(listener_key);
            }
        });

        return result;
    }

    /**
     * Add once time listener to event
     * @param {string|Array} events
     * @param {string|function} listener
     * @param {number|{}} options
     * @return {string|string|boolean|null} Listener key
     */
    EventEmitter.prototype.addOnceListener = function (events, listener, options) {
        if (_.isNumber(options)) {
            options = {
                priority: options
            }
        } else if (!_.isObject(options)) {
            options = {};
        }

        options.times = 1;

        return this.addListener(events, listener, options);
    };

    /**
     * Add listeners by object
     * @param {{}} events Object of events: object key is name of event, object value is array of events
     * @return {string[]} Listener keys
     */
    EventEmitter.prototype.addListeners = function (events) {
        var events_arr = [],
            self = this,
            keys = [];

        if (_.isObject(events)) {
            _.each(events, function (event_cbs, event_name) {
                event_cbs = _.castArray(event_cbs);

                _.each(event_cbs, function (event_cb) {
                    event_cb = _.castArray(event_cb);
                    events_arr.push({
                        name: event_name,
                        cb: event_cb[0],
                        options: event_cb.length > 1 ? event_cb[1] : {}
                    });
                });
            });
        }

        _.each(events_arr, function (event_info) {
            keys.push(self.addListener(event_info['name'], event_info['cb'], event_info['options']));
        });

        return keys;
    };

    /**
     * Mimic events
     * - no parameters: set instance's mimic status is true
     * - (boolean): set instance's mimic status is true|false
     * - (listen_object_or_id): listening object or id
     * - (boolean, listen_object_or_id): set mimic status of listening object is true|false
     * - (events, listen_object_or_id): set mimic events of listening object
     *
     * @param {string|string[]|boolean|EventEmitter} [events]
     * @param {EventEmitter|null|string} [target] Target instance, ID or name
     */
    EventEmitter.prototype.mimic = function (events, target) {
        if (!arguments.length) {
            this._mimics = true;
            return;
        }
        if (arguments.length == 1) {
            if (_.isBoolean(events)) {
                this._mimics = events;
            } else if (_.isObject(events) && !_.isArray(events) && this.isListening(events)) {
                this._listening[get_listen_id(this, events.id || events)].mimics = true;
            } else {
                events = _.filter(_.flatten(_.castArray(events)), _.isString);
                events = arrayToObject(events);

                if (!_.isObject(this._mimics)) {
                    this._mimics = events;
                } else {
                    _.extend(this._mimics, events);
                }
            }

            return;
        }

        target = get_listen_id(this, _.isObject(target) ? target.id : target);

        if (!target) {
            throw new Error('Invalid target');
        }

        if (_.isBoolean(events)) {
            if (!this.isListening(target)) {
                throw new Error('The target is not listening');
            }

            this._listening[target].mimics = events;

            return;
        }

        var self = this;

        events = _.castArray(events);
        _.each(events, function (event) {
            if (!_.isObject(self._listening[target].mimics)) {
                self._listening[target].mimics = {};
            }

            self._listening[target].mimics[event] = true;
        });
    };

    /**
     * Check if an event is a mimic event
     * @param {string} event
     * @param {EventEmitter} [target]
     * @return {boolean}
     */
    EventEmitter.prototype.isMimic = function (event, target) {
        return is_mimic(this, event, target);
    };

    /**
     * Set or add private events
     * @param {boolean|string|Array} events
     */
    EventEmitter.prototype.private = function (events) {
        if (_.isBoolean(events)) {
            this._private_events = events ? true : {};
        } else {
            events = _.filter(_.toArray(arguments), _.isString);

            if (!_.isObject(this._private_events)) {
                this._private_events = {};
            }

            _.extend(this._private_events, arrayToObject(events));
        }
    };

    /**
     * Emit event
     * @param {string} event Event name
     * @param {*} [data...] Event data
     */
    EventEmitter.prototype.emitEvent = function (event, data) {
        data = Array.prototype.slice.call(arguments, 1);

        if (this._events.hasOwnProperty(event)) {
            _emit_event(this, event, data);
        }

        if (this._events.hasOwnProperty('notify') && !is_private_event(this, event)) {
            _emit_event(this, 'notify', [event].concat(data));
        }

        _emit_event(this, event + '_complete', data);

        if (event !== 'event_emitted') {
            _emit_event(this, 'event_emitted', [event].concat(data));
        }

    };
    EventEmitter.prototype.emit = EventEmitter.prototype.emitEvent;
    EventEmitter.prototype.trigger = EventEmitter.prototype.emitEvent;

    /**
     * Similar to method emitEvent but do a callback after event is emitted
     * @param {string} event Event name
     * @param {function} final_cb Callback will receive parameter is data assigned to this method
     * @param {*} [data...]
     */
    EventEmitter.prototype.emitEventThen = function (event, final_cb, data) {
        data = Array.prototype.slice.call(arguments, 2);
        this.emitEvent.apply(this, [event].concat(data));

        final_cb.apply(this, data);
    };
    EventEmitter.prototype.emitThen = EventEmitter.prototype.emitEventThen;
    EventEmitter.prototype.triggerThen = EventEmitter.prototype.emitEventThen;
    EventEmitter.prototype.isListening = function (target, event) {
        var id = _.isObject(target) ? target.id : target;

        if (!(_.isString(id) || _.isNumber(id) && _.isFinite(id) && !_.isNaN(id))) {
            return false;
        }

        if (this._listening.hasOwnProperty(id) && (!_.isObject(target) || this._listening[id].target === target)) {
            if (event) {
                return is_valid_listening_event(event, this._listening[id].only, this._listening[id].except);
            }

            return true;
        }

        id = get_listen_id(this, id);

        return !_.isUndefined(id);
    };

    /**
     *
     * @param {EventEmitter} target
     * @param name
     * @param options
     * @return {string|boolean}
     */
    EventEmitter.prototype.listen = function (target, name, options) {
        if (!_.isObject(target)) {
            throw new Error('Listen target must be an object');
        }
        if (this.isListening(target)) {
            return true;
        }
        if (!_.isString(name)) {
            options = name;
            name = target.id;
        }
        if (_.isArrayLike(options)) {
            options = {
                only: arrayToObject(options)
            }
        }

        options = _.defaults(options || {}, {
            target: target,
            name: name,
            only: true,
            except: {},
            async: true,
            add_method: 'addListener',
            remove_method: 'removeListener',
            event: 'notify',
            mimics: {}
        });

        if (!_.isBoolean(options.mimics)) {
            options.mimics = arrayToObject(options.mimics);
        }
        if (!_.isBoolean(options.only)) {
            options.only = arrayToObject(options.only);
        }

        options.except = arrayToObject(options.except);

        var self = this,
            callback = function () {
                notify_listen_callback.apply(this, [self, name].concat(Array.prototype.slice.call(arguments)));
            };

        var listen_options = {
            async: options.async
        };

        this.emitEvent('before_listen', target, options);

        if (_.isString(options.add_method)) {
            options.listener_key = target[options.add_method](options.event, callback, listen_options);
        } else {
            options.listener_key = options.add_method(this, target, options, callback, listen_options);
        }

        if (_.isUndefined(options.listener_key) || _.isNull(options.listener_key)) {
            throw new Error('Added listener key received by add method is invalid');
        }

        this.emitEvent('listen', target, options);
        this._listening[target.id] = _.omit(options, ['async', 'add_method', 'event']);

        return options.listener_key;
    };

    /**
     *
     * @param {string|EventEmitter} target
     */
    EventEmitter.prototype.unlisten = function (target) {
        if (!arguments.length) {
            _.map(_.keys(this._listening), _.partial(un_listen, this));

            this._listening = {};
        } else {
            target = _.isObject(target) ? target.id : target;

            if (this.isListening(target)) {
                un_listen(this, target);
            }
        }
    };

    /**
     * Get object from array, object key is array values
     * @param {*} array
     * @return {{}}
     */
    function arrayToObject(array) {
        array = _.castArray(array);

        return _.zipObject(array, _.fill(new Array(array.length), true));
    }

    function _emit_event(instance, event_name, data) {
        var listeners;

        if (!instance._events.hasOwnProperty(event_name)) {
            return
        }

        listeners = getListeners(instance, event_name);

        if (!listeners.length) {
            return;
        }

        _.each(listeners, function (listener_detail) {
            if (listener_detail.times === true || listener_detail.times > 0) {
                if (listener_detail.async) {
                    async_callback(listener_detail.listener, data, listener_detail.context || instance.bound, listener_detail.delay);
                } else {
                    do_callback(listener_detail.listener, data, listener_detail.context || instance.bound);
                }

                if (listener_detail.times === true) {
                    return;
                }

                listener_detail.times--;

                if (listener_detail.times > 0) {
                    instance._events[event_name][listener_detail.event_index_key].times = listener_detail.times;

                    return;
                }
            }

            instance.removeListener(listener_detail.listener_key, event_name);
        });
    }

    /**
     *
     * @param {EventEmitter} instance
     * @param {string} event
     * @return {boolean}
     */
    function is_private_event(instance, event) {
        return true === instance._private_events || _.isObject(instance._private_events) && instance._private_events.hasOwnProperty(event);
    }

    /**
     * Check if an event is mimic
     * @param {EventEmitter} instance
     * @param {string} event
     * @param {EventEmitter|string} target Object which has ID field or listen instance ID or listen instance name
     * @return {boolean}
     */
    function is_mimic(instance, event, target) {
        if (_.isBoolean(instance._mimics)) {
            return instance._mimics;
        }
        if (_.isObject(instance._mimics) && instance._mimics.hasOwnProperty(event)) {
            return true;
        }
        if (!target) {
            return instance._mimics.hasOwnProperty(event);
        } else {
            target = get_listen_id(instance, _.isObject(target) ? target.id : target);

            if (target) {
                if (true === instance._listening[target].mimics
                    || (_.isObject(instance._listening[target].mimics) && instance._listening[target].mimics.hasOwnProperty(event))) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     *
     * @param {EventEmitter} instance
     * @param {string} event
     * @return {Array}
     */
    function getListeners(instance, event) {
        if (!instance._events.hasOwnProperty(event)) {
            return [];
        }

        var listeners = [];

        _.each(instance._events[event], function (event_detail, index_key) {
            if (instance._listeners.hasOwnProperty(event_detail.listener_key)) {
                event_detail.listener = instance._listeners[event_detail.listener_key].listener;
                event_detail.event_index_key = index_key;

                listeners.push(_.cloneDeep(event_detail));
            }
        });

        return _.sortBy(listeners, 'priority');
    }

    function do_callback(callback, args, context) {
        if (arguments.length >= 2) {
            args = _.castArray(args);
        } else {
            args = [];
        }

        if (callback) {
            if (_.isArray(callback)) {
                var result = [];

                _.each(callback, function (callback_item) {
                    result.push(callback_item.apply(context || null, args));
                });

                return result;
            } else if (_.isFunction(callback)) {
                return callback.apply(context || null, args);
            }
        }

        return undefined;
    }

    function async_callback(callback, args, context, delay) {
        delay = parseInt(delay);
        if (_.isNaN(delay) || !_.isFinite(delay)) {
            delay = 1;
        }

        return setTimeout(function () {
            do_callback(callback, args, context || null);
        }, Math.max(1, delay));
    }

    /**
     * Get listening ID from name
     * @param {EventEmitter} instance
     * @param {string} name
     * @return {string|undefined}
     */
    function get_listen_id(instance, name) {
        if (instance._listening.hasOwnProperty(name)) {
            return name;
        }
        return _.findKey(instance._listening, ['name', name]);
    }

    /**
     * Callback use to add to base object of listening
     * @param {EventEmitter} host
     * @param {string} name Instance named
     * @param {string} event Event name
     * @param {*} [data...] Event data
     */
    function notify_listen_callback(host, name, event, data) {
        var source = this;

        if (!host.isListening(source)) {
            return;
        }
        var listen_detail = host._listening[source.id];

        if (!is_valid_listening_event(event, listen_detail.only, listen_detail.except)) {
            return;
        }

        var event_data = Array.prototype.slice.call(arguments, 3),
            events = {};

        events[source.id + '.' + event] = true;
        events[name + '.' + event] = true;

        if (is_mimic(host, event, source.id)) {
            events[event] = true;
        }

        _.each(_.keys(events), function (target_event) {
            host.emitEvent.apply(host, [target_event].concat(event_data));
        });
        host.emitEvent.apply(host, ['notified', event].concat(event_data));
    }

    function is_valid_listening_event(event, only, except) {
        return !except.hasOwnProperty(event) && (true === only || only.hasOwnProperty(event));
    }

    function un_listen(instance, listen_id) {
        var detail = instance._listening[listen_id];

        if (!detail) {
            return;
        }

        instance.emitEvent('before_unlisten', detail.target, detail);

        if (_.isString(detail.remove_method)) {
            detail.target[detail.remove_method](detail.listener_key);
        } else {
            detail.remove_method(detail.listener_key);
        }

        instance.emitEvent('unlisten', detail.target, detail);

        delete instance._listening[listen_id];
    }

    EventEmitter.isEventEmitter = function (object) {
        return object instanceof EventEmitter;
    };

    return EventEmitter;
}));