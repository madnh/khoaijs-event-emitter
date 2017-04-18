describe('KhoaiJS - ContentManager', function () {
    var expect = chai.expect,
        chai_assert = chai.assert;

    var items;

    function reset_each_descibe() {
        Khoai.util.resetID('ContentManager');

        if (items) {
            Khoai.util.resetID(items.id);
            Khoai.util.resetID(items.id + '_string');
            Khoai.util.resetID(items.id + '_number');
            Khoai.util.resetID(items.id + '_boolean');
            Khoai.util.resetID(items.id + '_Array');
        }

        items = new ContentManager();
    }

    before(reset_each_descibe);

    describe('Static property of KhoaiJS', function () {
        it('ContentManager must be a static property of KhoaiJS if exists', function (cb) {
            if (window.hasOwnProperty('Khoai')) {
                chai_assert.property(Khoai, 'ContentManager');
                cb();
            } else {
                cb();
            }
        });
        it('Static property of KhoaiJS and standalone object of ContentManager must be same', function (cb) {
            if (window.hasOwnProperty('Khoai')) {
                chai_assert.strictEqual(Khoai.ContentManager, ContentManager);
                cb();
            } else {
                cb();
            }
        })
    });
    describe('Add, check exists by key, content type and content value, get content', function () {
        before(reset_each_descibe);

        it('Add', function () {
            var val = 'a',
                key,
                detail;

            chai_assert.isString(key = items.add(val));
            chai_assert.isTrue(items.isValidKey(key));
            chai_assert.isTrue(items.has(key));
            chai_assert.isTrue(items.hasType('string'));
            chai_assert.isTrue(items.hasContent(val));
            chai_assert.isTrue(items.hasContent(val, 'string'));
            //
            chai_assert.isObject(detail = items.get(key));
            chai_assert.property(detail, 'content');
            chai_assert.strictEqual(detail.content, val);
            chai_assert.property(detail, 'meta');
            chai_assert.isUndefined(detail.meta);
            //
            var keys = items.keys();
            //
            chai_assert.isObject(keys);
            chai_assert.property(keys, 'string');
            chai_assert.sameMembers(keys['string'], [key]);
        });
        it('Add, unique', function () {
            var val = Khoai.util.randomString(20),
                key = items.add(val);

            chai_assert.strictEqual(items.addUnique(val), key);
            chai_assert.notEqual(items.addUnique(val + '_'), key);
        });
        it('Add, meta', function () {
            var val = true,
                meta = {id: 1},
                key,
                detail;

            chai_assert.isString(key = items.add(val, meta));
            chai_assert.isTrue(items.has(key));
            chai_assert.isTrue(items.hasType('boolean'));
            chai_assert.isTrue(items.hasContent(val));
            chai_assert.isTrue(items.hasContent(val, 'boolean'));
            //
            chai_assert.isObject(detail = items.get(key));
            chai_assert.property(detail, 'content');
            chai_assert.strictEqual(detail.content, val);
            chai_assert.property(detail, 'meta');
            chai_assert.deepEqual(detail.meta, meta);
            chai_assert.deepEqual(detail.meta, items.getMeta(key));
        });
        it('Add, meta, custom type', function () {
            var val = [1, 2, 3],
                meta = {name: 'M'},
                type = 'yahoo',
                key,
                detail;

            chai_assert.isString(key = items.add(val, meta, type));
            chai_assert.isTrue(items.has(key));
            chai_assert.isTrue(items.hasType(type));
            //
            chai_assert.isObject(detail = items.get(key));
            chai_assert.property(detail, 'content');
            chai_assert.sameMembers(detail.content, val);
            chai_assert.property(detail, 'meta');
            chai_assert.deepEqual(detail.meta, meta);
            chai_assert.deepEqual(detail.meta, items.getMeta(key));
            //
            chai_assert.sameMembers(items.getContent(key), val);
        });
        it('Return false when get non-exists key', function () {
            chai_assert.isFalse(items.get('non-exists-key'));
        });
        it('Return default value when get non-exists key', function () {
            chai_assert.strictEqual(items.getContent('non-exists-key', 'yahoo'), 'yahoo');
        });
    });
    describe('Update', function () {
        before(reset_each_descibe);

        it('content', function () {
            var val_before = 1,
                val_after = 2,
                key = items.add(val_before);
            //
            chai_assert.strictEqual(items.getContent(key), val_before);
            chai_assert.doesNotThrow(function () {
                items.update(key, val_after);
            });
            chai_assert.strictEqual(items.getContent(key), val_after);
        });
        it('content and meta', function () {
            var val_before = 1,
                val_after = 2,
                meta_before = {id: 1},
                meta_after = {id: 2},
                key = items.add(val_before, meta_before);
            //
            chai_assert.strictEqual(items.getContent(key), val_before);
            chai_assert.deepEqual(items.getMeta(key), meta_before);
            chai_assert.doesNotThrow(function () {
                items.update(key, val_after, meta_after);
            });
            chai_assert.strictEqual(items.getContent(key), val_after);
            chai_assert.deepEqual(items.getMeta(key), meta_after);
        });
        it('meta only', function () {
            var val = 1,
                meta_before = {id: 1},
                meta_after = {id: 2},
                key = items.add(val, meta_before);
            //
            chai_assert.strictEqual(items.getContent(key), val);
            chai_assert.deepEqual(items.getMeta(key), meta_before);
            chai_assert.doesNotThrow(function () {
                items.updateMeta(key, meta_after);
            });
            chai_assert.deepEqual(items.getMeta(key), meta_after);
        });

    });
    describe('Remove', function () {
        before(reset_each_descibe);

        function valid_remove_key(key) {
            var removed = [];

            chai_assert.isTrue(items.has(key));
            chai_assert.doesNotThrow(function () {
                removed = items.remove(key);
            });
            chai_assert.isArray(removed);
            chai_assert.sameDeepMembers(removed, [{
                type: 'string',
                key: key
            }]);
            chai_assert.isFalse(items.has(key));
        }

        it('remove by an exists key', function () {
            var key = items.add('a');
            //
            valid_remove_key(key);
        });
        it('only remove special key', function () {
            var value = Khoai.util.randomString(10),
                key = items.add(value),
                key_2 = items.add(value);
            //
            valid_remove_key(key);
            chai_assert.isTrue(items.has(key_2));
        });
        it('remove all item by value', function () {
            var value = Khoai.util.randomString(20),
                key = items.add(value),
                key_2 = items.add(value);
            //
            chai_assert.isTrue(items.has(key));
            chai_assert.isTrue(items.has(key_2));
            chai_assert.isTrue(items.hasContent(value));
            //
            items.removeContent(value);
            //
            chai_assert.isFalse(items.has(key));
            chai_assert.isFalse(items.has(key_2));
            //
            chai_assert.isFalse(items.hasContent(value));
        });
    });
    describe('Filter', function () {
        var values = [],
            must_be = [];

        var callback = function (content, meta, key, type) {
            return -1 !== values.indexOf(content);
        };

        before(function () {
            reset_each_descibe();
            values = [Khoai.util.randomString(10), true, 123, Khoai.util.randomString(10)];

            _.each(values, function (item) {
                must_be.push({
                    type: Khoai.util.contentType(item),
                    key: items.add(item),
                    meta: undefined,
                    content: item
                });
            });
        });

        it('All of types', function () {
            var filtered = items.filter(callback);
            //
            chai_assert.sameDeepMembers(filtered, must_be);
        });
        it('Special type', function () {
            var filtered = items.filter(callback, 'string');
            //
            chai_assert.sameDeepMembers(filtered, _.filter(must_be, function (must_be_item) {
                return must_be_item.type === 'string';
            }));
        });
    });
    describe('Find', function () {
        var value, must_be;
        var callback = function (content) {
            return content === value;
        };
        before(function () {
            reset_each_descibe();
            value = Khoai.util.randomString(20);
            must_be = {
                type: 'string',
                key: items.add(value),
                meta: undefined,
                content: value
            };
        });

        it('must return object if found', function () {
            var found = items.find(callback);
            chai_assert.deepEqual(found, must_be);
        });
        it('custom type, must return object if found', function () {
            chai_assert.deepEqual(items.find(callback, 'string'), must_be);
        });
        it('must return false if not found', function () {
            chai_assert.isFalse(items.find(function () {
                return false;
            }));
        });
        it('must return false when custom type non-exists', function () {
            chai_assert.isFalse(items.find(callback, 'other_type'));
        });
    });
    describe('Using', function () {
        before(reset_each_descibe);
        var value = 'item',
            key;

        it('Return true for an exists key', function () {
            key = items.add(value);
            //
            chai_assert.isTrue(items.has(key));
            chai_assert.isTrue(items.using(key));
            chai_assert.isTrue(items.isUsing(key));
        });
        it('Return false if key isn\'t exists', function () {
            var non_exists_key = _.now() + Khoai.util.randomString(5);
            //
            chai_assert.isFalse(items.has(non_exists_key));
            chai_assert.isFalse(items.using(non_exists_key));
            chai_assert.isFalse(items.isUsing(non_exists_key));
        });
        it('Return true if a content is using', function () {
            chai_assert.isTrue(items.isUsing(key));
            chai_assert.isTrue(items.isUsingContent(value));
        });
        it('Return false if a content is unused', function () {
            var non_exists_content = _.now() + Khoai.util.randomString(5);
            //
            chai_assert.isFalse(items.hasContent(non_exists_content));
            chai_assert.isFalse(items.isUsingContent(non_exists_content));
        });
        it('unused an using key', function () {
            var other_using_key = items.add(Khoai.util.randomString(10));
            //
            chai_assert.isTrue(items.using(other_using_key));
            chai_assert.isTrue(items.isUsing(other_using_key));
            //
            items.unused(other_using_key);
            //
            chai_assert.isTrue(items.has(other_using_key));
            chai_assert.isFalse(items.isUsing(other_using_key));
            items.remove(other_using_key);
        });
        it('Valid usingKeys', function () {
            var using_keys = items.usingKeys();
            //
            chai_assert.isArray(using_keys);
            chai_assert.isAbove(using_keys.length, 0);
            chai_assert.include(using_keys, key);
        });
        it('Valid usingKeys grouped', function () {
            var using_keys_grouped = items.usingKeys(true);
            //
            chai_assert.isObject(using_keys_grouped);
            chai_assert.property(using_keys_grouped, 'string');
            chai_assert.sameMembers(using_keys_grouped['string'], [key]);
        });

        it('remove using keys', function () {
            var using_keys = items.usingKeys(true),
                removed_using_keys = _.groupBy(items.removeUsing(), 'type');
            //
            removed_using_keys = _.mapValues(removed_using_keys, function (array_of_detail) {
                return _.map(array_of_detail, 'key');
            });

            chai_assert.deepEqual(using_keys, removed_using_keys);
            chai_assert.isFalse(items.isUsing(key));
        });
        it('remove unused keys', function () {
            var other_key = items.add(Khoai.util.randomString(10)),
                unused_keys = items.unusedKeys(true),
                removed_unused_keys = _.groupBy(items.removeNotUsing(), 'type');
            //
            removed_unused_keys = _.mapValues(removed_unused_keys, function (array_of_detail) {
                return _.map(array_of_detail, 'key');
            });
            chai_assert.deepEqual(unused_keys, removed_unused_keys);
            chai_assert.isFalse(items.has(other_key));
            chai_assert.isFalse(items.isUsing(other_key));
        });


    });
});